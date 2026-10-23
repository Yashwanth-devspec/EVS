"""
backend/geo.py — Geocoding proxy for EcoRide Share.

The browser only ever talks to our own /geo/* endpoints. This module talks to:
  - Photon (komoot) for type-ahead search and reverse geocoding,
  - Nominatim, only when the user presses Enter / submits (never as autocomplete),
  - Google Maps short links, resolved by following redirects on an allowlist of hosts.

Every upstream call goes through a global queue limited to one request per second
per provider, and every answer is cached for 24 hours.
"""
import os
import re
import time
import logging
import threading
from typing import Any, Callable, Dict, List, Optional, Tuple
from urllib.parse import urlsplit, urljoin, unquote

import httpx

from backend.config import CONFIG
from backend.distance import haversine_distance_km, offline_mode

logger = logging.getLogger("ecoride.geo")

THROTTLED_MESSAGE = "Lots of people are searching right now. Try again in a moment, pick an area below, or drop a pin."
UNAVAILABLE_MESSAGE = "Address search isn't available right now. Pick an area below or drop a pin."
OUT_OF_RANGE_MESSAGE = "That's too far for a shared cab from the airport. Try a closer drop point, or book alone."


# -----------------------------------------------------------------------------
# Cache and global queue
# -----------------------------------------------------------------------------
class TTLCache:
    def __init__(self, ttl_sec: float, max_items: int = 5000, clock: Callable[[], float] = time.monotonic):
        self.ttl_sec = ttl_sec
        self.max_items = max_items
        self.clock = clock
        self._data: Dict[Any, Tuple[float, Any]] = {}
        self._lock = threading.Lock()

    def get(self, key: Any) -> Optional[Any]:
        with self._lock:
            hit = self._data.get(key)
            if hit is None:
                return None
            stored_at, value = hit
            if self.clock() - stored_at > self.ttl_sec:
                del self._data[key]
                return None
            return value

    def set(self, key: Any, value: Any) -> None:
        with self._lock:
            if len(self._data) >= self.max_items:
                # Drop the oldest tenth rather than the whole cache
                for k in sorted(self._data, key=lambda k: self._data[k][0])[: self.max_items // 10]:
                    del self._data[k]
            self._data[key] = (self.clock(), value)

    def clear(self) -> None:
        with self._lock:
            self._data.clear()


class GlobalQueue:
    """
    One upstream request per `min_interval` seconds across all users.
    Callers reserve the next free slot; if that slot is more than `max_wait`
    seconds away the call is refused (throttled) instead of piling up.
    """

    def __init__(
        self,
        min_interval: float,
        max_wait: float,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
    ):
        self.min_interval = min_interval
        self.max_wait = max_wait
        self.clock = clock
        self.sleep = sleep
        self._next_slot = 0.0
        self._lock = threading.Lock()

    def acquire(self) -> bool:
        with self._lock:
            now = self.clock()
            slot = max(now, self._next_slot)
            wait = slot - now
            if wait > self.max_wait:
                return False
            self._next_slot = slot + self.min_interval
        if wait > 0:
            self.sleep(wait)
        return True

    def reset(self) -> None:
        with self._lock:
            self._next_slot = 0.0


SEARCH_CACHE = TTLCache(CONFIG.GEO_CACHE_TTL_SEC)
REVERSE_CACHE = TTLCache(CONFIG.GEO_CACHE_TTL_SEC)
LOOKUP_CACHE = TTLCache(CONFIG.GEO_CACHE_TTL_SEC)
PHOTON_QUEUE = GlobalQueue(CONFIG.GEO_MIN_INTERVAL_SEC, CONFIG.GEO_MAX_QUEUE_WAIT_SEC)
NOMINATIM_QUEUE = GlobalQueue(CONFIG.GEO_MIN_INTERVAL_SEC, CONFIG.GEO_MAX_QUEUE_WAIT_SEC)


def reset_geo_state() -> None:
    for c in (SEARCH_CACHE, REVERSE_CACHE, LOOKUP_CACHE):
        c.clear()
    PHOTON_QUEUE.reset()
    NOMINATIM_QUEUE.reset()


class UpstreamThrottled(Exception):
    pass


def user_agent() -> str:
    contact = os.getenv("ECORIDE_GEO_CONTACT")
    return f"{CONFIG.GEO_USER_AGENT[:-1]}; {contact})" if contact else CONFIG.GEO_USER_AGENT


def http_get_json(url: str, params: Dict[str, Any]) -> Any:
    """Single choke point for upstream geocoder calls (tests replace this)."""
    if offline_mode():
        raise RuntimeError("offline mode")
    with httpx.Client(timeout=CONFIG.GEO_TIMEOUT_SEC) as client:
        resp = client.get(url, params=params, headers={"User-Agent": user_agent(), "Accept-Language": "en"})
    if resp.status_code == 429:
        raise UpstreamThrottled()
    resp.raise_for_status()
    return resp.json()


# -----------------------------------------------------------------------------
# Areas and service range
# -----------------------------------------------------------------------------
def airport_distance_km(lat: float, lng: float) -> float:
    return haversine_distance_km(CONFIG.AIRPORT_CENTROID_LAT, CONFIG.AIRPORT_CENTROID_LNG, lat, lng)


def in_service_range(lat: float, lng: float) -> bool:
    return airport_distance_km(lat, lng) <= CONFIG.SERVICE_RADIUS_KM


def nearest_area(lat: float, lng: float) -> str:
    key = min(
        CONFIG.ZONES.keys(),
        key=lambda z: haversine_distance_km(lat, lng, CONFIG.ZONES[z].lat, CONFIG.ZONES[z].lng),
    )
    return CONFIG.ZONES[key].name


def service_bbox() -> str:
    """minLon,minLat,maxLon,maxLat around the airport, sized to the service radius."""
    dlat = CONFIG.SERVICE_RADIUS_KM / 111.0
    dlng = CONFIG.SERVICE_RADIUS_KM / 108.0  # ~111 km * cos(13 degrees)
    lat, lng = CONFIG.AIRPORT_CENTROID_LAT, CONFIG.AIRPORT_CENTROID_LNG
    return f"{lng - dlng:.4f},{lat - dlat:.4f},{lng + dlng:.4f},{lat + dlat:.4f}"


def with_range(result: Dict[str, Any]) -> Dict[str, Any]:
    d = airport_distance_km(result["lat"], result["lng"])
    result["distance_from_airport_km"] = round(d, 1)
    result["in_range"] = d <= CONFIG.SERVICE_RADIUS_KM
    return result


def local_area_matches(q: str) -> List[Dict[str, Any]]:
    """The 16 known areas, matched by name, so common searches work instantly and offline."""
    q = q.strip().lower()
    out = []
    for key, z in CONFIG.ZONES.items():
        names = {key.lower(), z.name.lower()}
        if any(q in n or (len(q) >= 4 and n in q) for n in names):
            out.append(with_range({
                "id": f"area:{key}",
                "name": z.name,
                "secondary": "Area, Bengaluru",
                "lat": z.lat,
                "lng": z.lng,
                "area": z.name,
                "accuracy": "area",
                "exact_address": None,
                "source": "area",
            }))
    return out


# -----------------------------------------------------------------------------
# Photon / Nominatim normalisation
# -----------------------------------------------------------------------------
AREA_TYPES = {"city", "district", "locality", "county", "state", "suburb", "neighbourhood"}


def city_label(raw: Optional[str]) -> str:
    """OSM often gives a revenue district ("Bangalore South") where people say Bengaluru."""
    if not raw or any(k in raw.lower() for k in ("bangalore", "bengaluru")):
        return "Bengaluru"
    return raw


def _join(parts: List[Optional[str]]) -> str:
    seen, out = set(), []
    for p in parts:
        if p and p.lower() not in seen:
            seen.add(p.lower())
            out.append(p)
    return ", ".join(out)


def normalize_photon(feature: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    props = feature.get("properties", {}) or {}
    coords = (feature.get("geometry") or {}).get("coordinates") or []
    if len(coords) != 2:
        return None
    lng, lat = float(coords[0]), float(coords[1])
    street = props.get("street")
    house = props.get("housenumber")
    street_line = _join([house, street]) if street else None
    name = props.get("name") or street_line or props.get("locality") or props.get("district")
    if not name:
        return None
    ptype = props.get("type", "")
    neighbourhood = props.get("locality") or props.get("district")
    if ptype in AREA_TYPES and ptype not in ("city", "county", "state"):
        neighbourhood = name
    area = neighbourhood or nearest_area(lat, lng)
    city = city_label(props.get("city") or props.get("county"))
    secondary = _join([street_line if street_line != name else None, area if area != name else None, city])
    accuracy = "area" if ptype in AREA_TYPES else "address"
    exact = _join([name, street_line if street_line != name else None, area, city, props.get("postcode")])
    return with_range({
        "id": f"photon:{props.get('osm_type', '')}{props.get('osm_id', '')}",
        "name": name,
        "secondary": secondary,
        "lat": lat,
        "lng": lng,
        "area": area,
        "accuracy": accuracy,
        "exact_address": exact if accuracy == "address" else None,
        "source": "photon",
    })


def normalize_nominatim(item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    try:
        lat, lng = float(item["lat"]), float(item["lon"])
    except (KeyError, ValueError):
        return None
    addr = item.get("address", {}) or {}
    area = addr.get("suburb") or addr.get("neighbourhood") or addr.get("quarter") or nearest_area(lat, lng)
    street_line = _join([addr.get("house_number"), addr.get("road")]) if addr.get("road") else None
    name = item.get("name") or street_line or area
    city = city_label(addr.get("city") or addr.get("town") or addr.get("county"))
    accuracy = "address" if (addr.get("road") or addr.get("house_number") or item.get("name")) else "area"
    return with_range({
        "id": f"nominatim:{item.get('osm_type', '')}{item.get('osm_id', '')}",
        "name": name,
        "secondary": _join([street_line if street_line != name else None, area if area != name else None, city]),
        "lat": lat,
        "lng": lng,
        "area": area,
        "accuracy": accuracy,
        "exact_address": item.get("display_name") if accuracy == "address" else None,
        "source": "nominatim",
    })


# -----------------------------------------------------------------------------
# Fixture provider (ECORIDE_GEO_FIXTURES=1): deterministic results for e2e runs
# -----------------------------------------------------------------------------
FIXTURE_PLACES = [
    ("Jayanagar 4th Block", "11th Main Road", "Jayanagar", 12.9279, 77.5826),
    ("Jayanagar 9th Block", "36th Cross Road", "Jayanagar", 12.9195, 77.5900),
    ("Lalbagh West Gate", "Lalbagh Road", "Basavanagudi", 12.9480, 77.5800),
    ("Forum Mall", "Hosur Road", "Koramangala", 12.9345, 77.6112),
    ("Indiranagar Metro Station", "100 Feet Road", "Indiranagar", 12.9784, 77.6385),
    ("Mysuru Palace", "Sayyaji Rao Road", "Mysuru", 12.3052, 76.6552),
]


def _fixture_feature(name: str, street: str, area: str, lat: float, lng: float) -> Dict[str, Any]:
    return {
        "geometry": {"coordinates": [lng, lat]},
        "properties": {
            "name": name, "street": street, "locality": area, "city": "Bengaluru" if area != "Mysuru" else "Mysuru",
            "type": "house", "osm_type": "F", "osm_id": abs(hash(name)) % 10**8,
        },
    }


def fixture_search(q: str) -> Dict[str, Any]:
    q = q.lower()
    feats = [_fixture_feature(*p) for p in FIXTURE_PLACES if q in p[0].lower() or q in p[2].lower()]
    return {"features": feats}


def fixture_reverse(lat: float, lng: float) -> Dict[str, Any]:
    area = nearest_area(lat, lng)
    return {"features": [{
        "geometry": {"coordinates": [lng, lat]},
        "properties": {"name": f"Near {area}", "locality": area, "city": "Bengaluru", "type": "street"},
    }]}


def fixtures_enabled() -> bool:
    return os.getenv("ECORIDE_GEO_FIXTURES", "") == "1"


# -----------------------------------------------------------------------------
# Public operations
# -----------------------------------------------------------------------------
def _merge(first: List[Dict[str, Any]], second: List[Dict[str, Any]], limit: int) -> List[Dict[str, Any]]:
    """Keeps the first of any results with the same name within 1.5 km of each other."""
    out: List[Dict[str, Any]] = []
    for r in first + second:
        dup = any(
            o["name"].lower() == r["name"].lower()
            and haversine_distance_km(o["lat"], o["lng"], r["lat"], r["lng"]) < 1.5
            for o in out
        )
        if not dup:
            out.append(r)
    return out[:limit]


def search(q: str) -> Dict[str, Any]:
    """Type-ahead search. Photon only; cached 24h; one upstream call per second globally."""
    q_norm = " ".join(q.strip().lower().split())
    local = local_area_matches(q_norm)
    cached = SEARCH_CACHE.get(q_norm)
    if cached is not None:
        return {"results": cached, "cached": True, "throttled": False, "message": None}

    if not PHOTON_QUEUE.acquire():
        return {"results": local[: CONFIG.GEO_RESULT_LIMIT], "cached": False, "throttled": True, "message": THROTTLED_MESSAGE}

    try:
        if fixtures_enabled():
            data = fixture_search(q_norm)
        else:
            data = http_get_json(f"{CONFIG.PHOTON_URL}/api/", {
                "q": q_norm,
                "lat": CONFIG.AIRPORT_CENTROID_LAT,
                "lon": CONFIG.AIRPORT_CENTROID_LNG,
                "zoom": 10,
                "location_bias_scale": 0.2,
                "bbox": service_bbox(),
                "limit": CONFIG.GEO_RESULT_LIMIT,
                "lang": "en",
            })
    except UpstreamThrottled:
        return {"results": local[: CONFIG.GEO_RESULT_LIMIT], "cached": False, "throttled": True, "message": THROTTLED_MESSAGE}
    except Exception as e:
        logger.warning("Photon search unavailable (%s)", type(e).__name__)
        return {"results": local[: CONFIG.GEO_RESULT_LIMIT], "cached": False, "throttled": False, "message": UNAVAILABLE_MESSAGE}

    remote = [r for r in (normalize_photon(f) for f in data.get("features", [])) if r]
    results = _merge(local, remote, CONFIG.GEO_RESULT_LIMIT)
    SEARCH_CACHE.set(q_norm, results)
    return {"results": results, "cached": False, "throttled": False, "message": None}


def lookup(q: str) -> Dict[str, Any]:
    """Enter / submit only. Nominatim with an identifying User-Agent, cached 24h."""
    q_norm = " ".join(q.strip().lower().split())
    cached = LOOKUP_CACHE.get(q_norm)
    if cached is not None:
        return {"results": cached, "cached": True, "throttled": False, "message": None}
    local = local_area_matches(q_norm)
    if not NOMINATIM_QUEUE.acquire():
        return {"results": local, "cached": False, "throttled": True, "message": THROTTLED_MESSAGE}
    try:
        if fixtures_enabled():
            data = [{
                "lat": f["geometry"]["coordinates"][1], "lon": f["geometry"]["coordinates"][0],
                "name": f["properties"]["name"],
                "address": {"road": f["properties"]["street"], "suburb": f["properties"]["locality"], "city": "Bengaluru"},
                "display_name": f'{f["properties"]["name"]}, {f["properties"]["street"]}, {f["properties"]["locality"]}, Bengaluru',
            } for f in fixture_search(q_norm)["features"]]
        else:
            lat, lng = CONFIG.AIRPORT_CENTROID_LAT, CONFIG.AIRPORT_CENTROID_LNG
            min_lng, min_lat, max_lng, max_lat = service_bbox().split(",")
            data = http_get_json(f"{CONFIG.NOMINATIM_URL}/search", {
                "q": q_norm,
                "format": "jsonv2",
                "addressdetails": 1,
                "limit": 5,
                "countrycodes": "in",
                "viewbox": f"{min_lng},{max_lat},{max_lng},{min_lat}",
                "bounded": 1,
            })
    except UpstreamThrottled:
        return {"results": local, "cached": False, "throttled": True, "message": THROTTLED_MESSAGE}
    except Exception as e:
        logger.warning("Nominatim lookup unavailable (%s)", type(e).__name__)
        return {"results": local, "cached": False, "throttled": False, "message": UNAVAILABLE_MESSAGE}
    remote = [r for r in (normalize_nominatim(i) for i in data) if r]
    results = _merge(remote, local, CONFIG.GEO_RESULT_LIMIT)
    LOOKUP_CACHE.set(q_norm, results)
    return {"results": results, "cached": False, "throttled": False, "message": None}


def reverse(lat: float, lng: float) -> Dict[str, Any]:
    """Address text for a pin. Cached by coordinates rounded to 4 decimals."""
    key = (round(lat, 4), round(lng, 4))
    cached = REVERSE_CACHE.get(key)
    if cached is not None:
        return {**cached, "cached": True}

    fallback_area = nearest_area(lat, lng)
    base = with_range({
        "name": f"Near {fallback_area}",
        "secondary": f"{fallback_area}, Bengaluru",
        "lat": lat,
        "lng": lng,
        "area": fallback_area,
        "accuracy": "pin",
        "exact_address": None,
        "source": "pin",
    })
    if not PHOTON_QUEUE.acquire():
        return {**base, "cached": False, "throttled": True, "message": THROTTLED_MESSAGE}
    try:
        data = fixture_reverse(lat, lng) if fixtures_enabled() else http_get_json(
            f"{CONFIG.PHOTON_URL}/reverse", {"lat": lat, "lon": lng, "limit": 1, "radius": 0.5, "lang": "en"}
        )
        feats = data.get("features", [])
        found = normalize_photon(feats[0]) if feats else None
    except UpstreamThrottled:
        return {**base, "cached": False, "throttled": True, "message": THROTTLED_MESSAGE}
    except Exception as e:
        logger.warning("Photon reverse unavailable (%s)", type(e).__name__)
        return {**base, "cached": False, "throttled": False, "message": None}

    result = base
    if found:
        result = {
            **base,
            "name": found["name"],
            "secondary": found["secondary"],
            "area": found["area"],
            "exact_address": found.get("exact_address") or _join([found["name"], found["secondary"]]),
        }
    REVERSE_CACHE.set(key, result)
    return {**result, "cached": False, "throttled": False, "message": None}


# -----------------------------------------------------------------------------
# Google Maps links
# -----------------------------------------------------------------------------
_NUM = r"(-?\d{1,3}(?:\.\d+)?)"
COORD_PATTERNS = [
    re.compile(rf"!3d{_NUM}!4d{_NUM}"),  # the dropped pin itself
    re.compile(rf"[?&](?:q|query|ll|destination|daddr|center|sll)=(?:loc:)?{_NUM}\s*,\s*{_NUM}"),
    re.compile(rf"@{_NUM},{_NUM}"),  # viewport centre, least precise
]
SHORT_LINK_HOSTS = {"maps.app.goo.gl", "goo.gl"}


class MapsLinkError(Exception):
    pass


def parse_maps_coords(url: str) -> Optional[Tuple[float, float]]:
    text = unquote(unquote(url))
    for pattern in COORD_PATTERNS:
        m = pattern.search(text)
        if m:
            lat, lng = float(m.group(1)), float(m.group(2))
            if -90 <= lat <= 90 and -180 <= lng <= 180:
                return lat, lng
    return None


def _allowed(url: str) -> bool:
    parts = urlsplit(url)
    host = (parts.hostname or "").lower()
    return (
        parts.scheme == "https"
        and host in CONFIG.MAPS_LINK_HOSTS
        and parts.port in (None, 443)
        and not parts.username
        and not parts.password
    )


def _fetch_location(url: str, timeout: float) -> Tuple[int, Optional[str]]:
    """Requests a URL without following redirects and without reading the body."""
    if offline_mode():
        raise MapsLinkError("offline")
    with httpx.Client(follow_redirects=False, timeout=timeout) as client:
        with client.stream("GET", url, headers={"User-Agent": user_agent()}) as resp:
            return resp.status_code, resp.headers.get("location")


def resolve_maps_link(url: str, fetch: Callable[[str, float], Tuple[int, Optional[str]]] = None) -> Tuple[float, float]:
    """
    Pulls coordinates out of a Google Maps link. Short links are followed on the server only,
    only through allowlisted Google Maps hosts, at most 3 redirects within 3 seconds, body never read.
    """
    fetch = fetch or _fetch_location
    url = url.strip()
    direct = parse_maps_coords(url)
    if direct:
        return direct
    if not _allowed(url):
        raise MapsLinkError("That doesn't look like a Google Maps link.")
    host = (urlsplit(url).hostname or "").lower()
    if host == "goo.gl" and not urlsplit(url).path.startswith("/maps"):
        raise MapsLinkError("That doesn't look like a Google Maps link.")
    if host not in SHORT_LINK_HOSTS:
        raise MapsLinkError("We couldn't find a location in that link. Try dropping a pin instead.")

    deadline = time.monotonic() + CONFIG.MAPS_LINK_TIMEOUT_SEC
    current = url
    for _ in range(CONFIG.MAPS_LINK_MAX_REDIRECTS):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            break
        try:
            status_code, location = fetch(current, remaining)
        except MapsLinkError:
            raise MapsLinkError("We couldn't open that link right now. Try dropping a pin instead.")
        except Exception:
            raise MapsLinkError("We couldn't open that link right now. Try dropping a pin instead.")
        if status_code not in (301, 302, 303, 307, 308) or not location:
            break
        nxt = urljoin(current, location)
        coords = parse_maps_coords(nxt)
        if coords:
            return coords
        if not _allowed(nxt):
            break
        current = nxt
    raise MapsLinkError("We couldn't find a location in that link. Try dropping a pin instead.")
