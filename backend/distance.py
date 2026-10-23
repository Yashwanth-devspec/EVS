"""
backend/distance.py — Distance service with SQLite cache, OSRM table API, and Haversine fallback.
"""
import os
import math
import logging
import threading
from typing import List, Tuple, Dict, Optional
import httpx
from sqlalchemy.orm import Session

from backend.config import CONFIG
from backend.models import DistanceCache
from backend.clock import now

logger = logging.getLogger("ecoride.distance")

def round_coord(coord: float) -> float:
    """Rounds coordinates to 4 decimal places (~11m resolution)."""
    return round(coord, 4)

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes great-circle distance in kilometers."""
    R = 6371.0  # Earth's radius in km
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

def fallback_road_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance multiplied by ROAD_FACTOR (1.35)."""
    return round(haversine_distance_km(lat1, lon1, lat2, lon2) * CONFIG.ROAD_FACTOR, 2)

def fallback_duration_sec(distance_km: float) -> float:
    """Estimates travel duration assuming average 35 km/h urban speed."""
    if distance_km <= 0.05:
        return 0.0
    return round((distance_km / 35.0) * 3600.0, 1)


def offline_mode() -> bool:
    """ECORIDE_OFFLINE=1 skips every external call (tests, e2e, demos without network)."""
    return os.getenv("ECORIDE_OFFLINE", "") == "1"


def osrm_disabled() -> bool:
    """ECORIDE_NO_OSRM=1 uses the straight-line estimate only, for repeatable e2e runs."""
    return offline_mode() or os.getenv("ECORIDE_NO_OSRM", "") == "1"


class DistanceService:
    def __init__(self, timeout_sec: float = 3.0):
        self.timeout_sec = timeout_sec
        # Public OSRM routing server
        self.osrm_base_url = "https://router.project-osrm.org/table/v1/driving"
        # In-process layer over the SQLite cache. Keys are coordinates rounded to 4 decimals.
        self._mem: Dict[Tuple[float, float, float, float], Tuple[float, float]] = {}
        self._lock = threading.Lock()

    def clear_memory(self) -> None:
        with self._lock:
            self._mem.clear()

    def _remember(self, p1, p2, km: float, sec: float) -> None:
        with self._lock:
            if len(self._mem) > 50000:
                self._mem.clear()
            self._mem[(p1[0], p1[1], p2[0], p2[1])] = (km, sec)

    def fetch_matrix(
        self,
        points: List[Tuple[float, float]],
        db: Optional[Session] = None
    ) -> Tuple[List[List[float]], List[List[float]]]:
        """
        Given a list of (lat, lng) points, returns:
          (distance_matrix_km, duration_matrix_sec)
        Checks DB cache first; requests OSRM /table for uncached pairs;
        falls back to Haversine * ROAD_FACTOR if OSRM is unreachable or times out.
        """
        n = len(points)
        dist_matrix: List[List[float]] = [[0.0] * n for _ in range(n)]
        dur_matrix: List[List[float]] = [[0.0] * n for _ in range(n)]

        # Check self-distances
        for i in range(n):
            dist_matrix[i][i] = 0.0
            dur_matrix[i][i] = 0.0

        # Look up cached pairs
        unresolved_pairs = []
        for i in range(n):
            for j in range(n):
                if i == j:
                    continue
                p1 = (round_coord(points[i][0]), round_coord(points[i][1]))
                p2 = (round_coord(points[j][0]), round_coord(points[j][1]))

                with self._lock:
                    mem_hit = self._mem.get((p1[0], p1[1], p2[0], p2[1]))
                if mem_hit is not None:
                    dist_matrix[i][j], dur_matrix[i][j] = mem_hit
                else:
                    unresolved_pairs.append((i, j, p1, p2))

        missing_pairs = []
        if unresolved_pairs:
            cached_map = {}
            if db is not None:
                origin_lats = {p1[0] for _, _, p1, _ in unresolved_pairs}
                origin_lngs = {p1[1] for _, _, p1, _ in unresolved_pairs}
                dest_lats = {p2[0] for _, _, _, p2 in unresolved_pairs}
                dest_lngs = {p2[1] for _, _, _, p2 in unresolved_pairs}

                cached_records = db.query(DistanceCache).filter(
                    DistanceCache.origin_lat.in_(origin_lats),
                    DistanceCache.origin_lng.in_(origin_lngs),
                    DistanceCache.dest_lat.in_(dest_lats),
                    DistanceCache.dest_lng.in_(dest_lngs),
                ).all()

                for r in cached_records:
                    key = (r.origin_lat, r.origin_lng, r.dest_lat, r.dest_lng)
                    cached_map[key] = (r.distance_km, r.duration_sec)

            for i, j, p1, p2 in unresolved_pairs:
                key = (p1[0], p1[1], p2[0], p2[1])
                if key in cached_map:
                    km, sec = cached_map[key]
                    dist_matrix[i][j] = km
                    dur_matrix[i][j] = sec
                    self._remember(p1, p2, km, sec)
                else:
                    missing_pairs.append((i, j, p1, p2))

        if not missing_pairs:
            return dist_matrix, dur_matrix

        # Attempt OSRM batch table query for all points
        saved_db_keys = set()
        osrm_success = False
        try:
            if osrm_disabled():
                raise RuntimeError("OSRM disabled")
            # OSRM format: lng,lat;lng,lat...
            coords_str = ";".join(f"{round_coord(p[1])},{round_coord(p[0])}" for p in points)
            url = f"{self.osrm_base_url}/{coords_str}?annotations=distance,duration"
            with httpx.Client(timeout=self.timeout_sec) as client:
                resp = client.get(url, headers={"User-Agent": "EcoRideShare-BLR/1.0"})
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("code") == "Ok" and "distances" in data:
                        raw_distances = data["distances"]
                        raw_durations = data.get("durations", [])
                        for i, j, p1, p2 in missing_pairs:
                            d_val = raw_distances[i][j]
                            if d_val is not None:
                                km = round(d_val / 1000.0, 2)
                                sec = round(raw_durations[i][j], 1) if raw_durations and raw_durations[i][j] is not None else fallback_duration_sec(km)
                                dist_matrix[i][j] = km
                                dur_matrix[i][j] = sec
                                self._remember(p1, p2, km, sec)
                                pair_key = (p1[0], p1[1], p2[0], p2[1])
                                if db is not None and pair_key not in saved_db_keys:
                                    saved_db_keys.add(pair_key)
                                    cache_entry = DistanceCache(
                                        origin_lat=p1[0], origin_lng=p1[1],
                                        dest_lat=p2[0], dest_lng=p2[1],
                                        distance_km=km, duration_sec=sec,
                                        source="osrm", cached_at=now()
                                    )
                                    db.add(cache_entry)
                        osrm_success = True
                        if db is not None and saved_db_keys:
                            try:
                                db.commit()
                            except Exception:
                                db.rollback()
        except Exception as e:
            if not osrm_disabled():
                logger.warning(f"OSRM table request failed or timed out ({e}). Falling back to Haversine * ROAD_FACTOR.")

        # Fallback to Haversine * ROAD_FACTOR for any still-missing pairs (OSRM down, or a null cell)
        for i, j, p1, p2 in missing_pairs:
            if dist_matrix[i][j] == 0.0 and i != j:
                km = fallback_road_distance_km(points[i][0], points[i][1], points[j][0], points[j][1])
                sec = fallback_duration_sec(km)
                dist_matrix[i][j] = km
                dur_matrix[i][j] = sec
                self._remember(p1, p2, km, sec)
                pair_key = (p1[0], p1[1], p2[0], p2[1])
                if db is not None and pair_key not in saved_db_keys:
                    saved_db_keys.add(pair_key)
                    cache_entry = DistanceCache(
                        origin_lat=p1[0], origin_lng=p1[1],
                        dest_lat=p2[0], dest_lng=p2[1],
                        distance_km=km, duration_sec=sec,
                        source="haversine_fallback", cached_at=now()
                    )
                    db.add(cache_entry)
        if db is not None and saved_db_keys:
            try:
                db.commit()
            except Exception:
                db.rollback()

        return dist_matrix, dur_matrix


DISTANCE_SERVICE = DistanceService()

def get_distance_matrix(
    points: List[Tuple[float, float]],
    db: Optional[Session] = None
) -> Tuple[List[List[float]], List[List[float]]]:
    """Helper function to fetch distance matrix."""
    return DISTANCE_SERVICE.fetch_matrix(points, db)
