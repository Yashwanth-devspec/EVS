"""
backend/config.py — EcoRide Share configuration.
Exposed to frontend via GET /config.
Every value represents a labelled, transparent assumption.
"""
from typing import Dict, Any, List
from pydantic import BaseModel, Field

class AirportTerminal(BaseModel):
    name: str
    lat: float
    lng: float
    pickup_nickname: str

class ZoneInfo(BaseModel):
    name: str
    lat: float
    lng: float
    cluster: str = "Central"  # North, South, East, West, Central

class CabTypeConfig(BaseModel):
    seats: int
    boot: int  # in large checked bag units
    multiplier: float
    name: str

class ConfigData(BaseModel):
    AIRPORT_CODE: str = "BLR"
    AIRPORT_NAME: str = "Kempegowda International Airport, Bengaluru"
    AIRPORT_CENTROID_LAT: float = 13.1986
    AIRPORT_CENTROID_LNG: float = 77.7066

    TERMINALS: Dict[str, AirportTerminal] = Field(default_factory=lambda: {
        "T1": AirportTerminal(
            name="Terminal 1",
            lat=13.1989,
            lng=77.7068,
            pickup_nickname="BLR T1 Cab Pickup (Lane 2)"
        ),
        "T2": AirportTerminal(
            name="Terminal 2",
            lat=13.2045,
            lng=77.7125,
            pickup_nickname="BLR T2 Cab Pickup (P4 Level 1)"
        )
    })

    # Buffer minutes from landing to pickup area
    EXIT_BUFFER_MIN: Dict[str, int] = Field(default_factory=lambda: {
        "domestic_cabin": 15,
        "domestic_checked": 30,
        "international_cabin": 35,
        "international_checked": 50,
    })

    # Wait tiers relative to viewer's own ready time (minutes)
    TIER_NOW_MAX: int = 15
    TIER_SOON_MAX: int = 30
    TIER_LATER_MAX: int = 60
    MAX_WAIT_OPTIONS: List[int] = [15, 30, 60]

    # Service area: drop points further than this from the airport are refused
    SERVICE_RADIUS_KM: float = 70.0

    # Matching constraints
    PREFILTER_RADIUS_KM: float = 10.0
    MAX_DETOUR_RATIO: float = 1.30
    MAX_EXTRA_KM_PER_MEMBER: float = 8.0
    MIN_SAVING_PCT: float = 10.0
    ROAD_FACTOR: float = 1.35  # Haversine to road distance multiplier

    # Cab fleet definitions
    CAB_TYPES: Dict[str, CabTypeConfig] = Field(default_factory=lambda: {
        "sedan": CabTypeConfig(seats=4, boot=3, multiplier=1.0, name="Sedan (Dzire / Etios)"),
        "suv": CabTypeConfig(seats=6, boot=4, multiplier=1.25, name="SUV (Innova / Ertiga)"),
        "tempo_traveller": CabTypeConfig(seats=9, boot=9, multiplier=1.6, name="Tempo Traveller (9 Seater)"),
    })

    # Fare components (INR) calibrated to ~Rs 1,500 for BLR -> Jayanagar solo
    FARE_BASE: float = 100.0
    FARE_PER_KM: float = 26.0
    AIRPORT_ACCESS_FEE: float = 250.0
    TOLL_FEE: float = 120.0
    FARE_DISCLAIMER: str = "Estimate only. The booking app (Uber, Ola, Rapido, etc.) sets the actual meter/upfront price."

    # Environmental impact coefficients
    CO2_KG_PER_KM: float = 0.17  # Average petrol/diesel passenger cab emission per km
    TREE_KG_PER_YEAR: float = 21.0  # Approx mature tree CO2 absorption per year

    # Timing and lifecycle
    CONFIRM_WINDOW_MIN: int = 5
    DEMO_CONFIRM_WINDOW_MIN: int = 2
    NO_SHOW_GRACE_MIN: int = 10
    PURGE_AFTER_HOURS: int = 24
    SEARCHING_MIN_MS: int = 1500

    # Geocoding proxy (third-party URLs never leave the backend)
    PHOTON_URL: str = "https://photon.komoot.io"
    NOMINATIM_URL: str = "https://nominatim.openstreetmap.org"
    # Nominatim's policy asks for an identifying User-Agent; set ECORIDE_GEO_CONTACT to add a contact
    GEO_USER_AGENT: str = "EcoRideShare-BLR/2.0 (airport cab-share coordination)"
    GEO_CACHE_TTL_SEC: int = 86400
    GEO_MIN_INTERVAL_SEC: float = 1.0
    GEO_MAX_QUEUE_WAIT_SEC: float = 2.5
    GEO_TIMEOUT_SEC: float = 4.0
    GEO_RESULT_LIMIT: int = 6
    MAPS_LINK_HOSTS: List[str] = Field(default_factory=lambda: [
        "maps.app.goo.gl", "goo.gl", "maps.google.com", "www.google.com", "google.com",
        "www.google.co.in", "google.co.in", "maps.google.co.in",
    ])
    MAPS_LINK_MAX_REDIRECTS: int = 3
    MAPS_LINK_TIMEOUT_SEC: float = 3.0

    # Map tiles are proxied through the backend too
    # OpenStreetMap standard tiles, cached by the proxy and darkened in CSS (CARTO now needs an API key)
    TILE_URL: str = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"

    # 16 Bengaluru zones with centroids
    ZONES: Dict[str, ZoneInfo] = Field(default_factory=lambda: {
        "Jayanagar": ZoneInfo(name="Jayanagar", lat=12.9308, lng=77.5838, cluster="South"),
        "JP Nagar": ZoneInfo(name="JP Nagar", lat=12.9063, lng=77.5857, cluster="South"),
        "BTM": ZoneInfo(name="BTM Layout", lat=12.9166, lng=77.6101, cluster="South"),
        "Koramangala": ZoneInfo(name="Koramangala", lat=12.9352, lng=77.6245, cluster="South-East"),
        "HSR": ZoneInfo(name="HSR Layout", lat=12.9121, lng=77.6446, cluster="South-East"),
        "Indiranagar": ZoneInfo(name="Indiranagar", lat=12.9784, lng=77.6408, cluster="East"),
        "Whitefield": ZoneInfo(name="Whitefield", lat=12.9698, lng=77.7499, cluster="East"),
        "Marathahalli": ZoneInfo(name="Marathahalli", lat=12.9591, lng=77.7009, cluster="East"),
        "Electronic City": ZoneInfo(name="Electronic City", lat=12.8452, lng=77.6602, cluster="South"),
        "Banashankari": ZoneInfo(name="Banashankari", lat=12.9255, lng=77.5468, cluster="South-West"),
        "Rajajinagar": ZoneInfo(name="Rajajinagar", lat=12.9982, lng=77.5530, cluster="West"),
        "Malleshwaram": ZoneInfo(name="Malleshwaram", lat=13.0031, lng=77.5703, cluster="North-West"),
        "Hebbal": ZoneInfo(name="Hebbal", lat=13.0358, lng=77.5970, cluster="North"),
        "Yelahanka": ZoneInfo(name="Yelahanka", lat=13.1007, lng=77.5963, cluster="North"),
        "Basavanagudi": ZoneInfo(name="Basavanagudi", lat=12.9422, lng=77.5755, cluster="South"),
        "MG Road": ZoneInfo(name="MG Road", lat=12.9756, lng=77.6066, cluster="Central"),
    })

CONFIG = ConfigData()

def get_public_config() -> Dict[str, Any]:
    """Returns the config dict with assumptions clearly labelled."""
    return {
        "airport": {
            "code": CONFIG.AIRPORT_CODE,
            "name": CONFIG.AIRPORT_NAME,
            "lat": CONFIG.AIRPORT_CENTROID_LAT,
            "lng": CONFIG.AIRPORT_CENTROID_LNG,
            "terminals": {k: v.model_dump() for k, v in CONFIG.TERMINALS.items()}
        },
        "exit_buffer_min": CONFIG.EXIT_BUFFER_MIN,
        "tiers": {
            "now_max": CONFIG.TIER_NOW_MAX,
            "soon_max": CONFIG.TIER_SOON_MAX,
            "later_max": CONFIG.TIER_LATER_MAX,
            "max_wait_options": CONFIG.MAX_WAIT_OPTIONS,
        },
        "service_radius_km": CONFIG.SERVICE_RADIUS_KM,
        "matching_rules": {
            "prefilter_radius_km": CONFIG.PREFILTER_RADIUS_KM,
            "max_detour_ratio": CONFIG.MAX_DETOUR_RATIO,
            "max_extra_km_per_member": CONFIG.MAX_EXTRA_KM_PER_MEMBER,
            "min_saving_pct": CONFIG.MIN_SAVING_PCT,
            "road_factor": CONFIG.ROAD_FACTOR,
        },
        "cab_types": {k: v.model_dump() for k, v in CONFIG.CAB_TYPES.items()},
        "fare_model": {
            "base": CONFIG.FARE_BASE,
            "per_km": CONFIG.FARE_PER_KM,
            "airport_access_fee": CONFIG.AIRPORT_ACCESS_FEE,
            "toll_fee": CONFIG.TOLL_FEE,
            "disclaimer": CONFIG.FARE_DISCLAIMER,
        },
        "environmental": {
            "co2_kg_per_km": CONFIG.CO2_KG_PER_KM,
            "tree_kg_per_year": CONFIG.TREE_KG_PER_YEAR,
        },
        "windows": {
            "confirm_window_min": CONFIG.CONFIRM_WINDOW_MIN,
            "demo_confirm_window_min": CONFIG.DEMO_CONFIRM_WINDOW_MIN,
            "no_show_grace_min": CONFIG.NO_SHOW_GRACE_MIN,
            "purge_after_hours": CONFIG.PURGE_AFTER_HOURS,
            "searching_min_ms": CONFIG.SEARCHING_MIN_MS,
        },
        "zones": {k: v.model_dump() for k, v in CONFIG.ZONES.items()}
    }
