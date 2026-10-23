"""
backend/schemas.py — Pydantic v2 schemas for API requests, responses, and validation.
"""
import re
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator

FLIGHT_REGEX = re.compile(r"^[A-Z0-9]{2}\d{1,4}[A-Z]?$")

class SessionCreate(BaseModel):
    first_name: str = Field(..., min_length=2, max_length=50)

class SessionResponse(BaseModel):
    session_id: str
    first_name: str
    completed_trips: int
    noshow_trips: int
    reliability_score: Optional[float]

UPI_REGEX = re.compile(r"^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z]{2,64}$")
# Indian number plates: KA 01 AB 1234 (state series) or 22 BH 1234 AA (Bharat series)
CAB_REGEX = re.compile(r"^(?:[A-Z]{2} ?\d{1,2} ?[A-Z]{0,3} ?\d{4}|\d{2} ?BH ?\d{4} ?[A-Z]{1,2})$")

class RequestCreate(BaseModel):
    # Only "where" and "when" are required. A first name is asked for when a share is confirmed.
    dest_lat: float = Field(..., ge=-90, le=90)
    dest_lng: float = Field(..., ge=-180, le=180)
    scheduled_arrival: datetime
    dest_label: Optional[str] = Field(default=None, max_length=128)
    area: Optional[str] = Field(default=None, max_length=64)
    zone: Optional[str] = Field(default=None, max_length=64)  # legacy alias for area
    accuracy: str = Field(default="area", pattern="^(address|pin|area)$")
    exact_address: Optional[str] = Field(default=None, max_length=256)
    drop_detail: Optional[str] = Field(default=None, max_length=128)
    first_name: Optional[str] = Field(default=None, min_length=2, max_length=50)
    flight_no: Optional[str] = None
    arriving_from: Optional[str] = Field(default=None, max_length=60)
    flight_kind: str = Field(default="domestic", pattern="^(domestic|international)$")
    delay_min: int = Field(default=0, ge=0, le=720)
    terminal: str = Field(default="T1", pattern="^(T1|T2)$")
    party_size: int = Field(default=1, ge=1, le=3)
    checked_bags: int = Field(default=0, ge=0, le=3)
    max_wait_min: int = Field(default=30)
    preferred_app: str = Field(default="any")
    women_only: bool = Field(default=False)
    adult_confirmed: bool = Field(default=True)
    upi_id: Optional[str] = Field(default=None, max_length=64)

    @field_validator("flight_no")
    @classmethod
    def validate_flight_no(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        clean = v.replace(" ", "").strip().upper()
        if not clean:
            return None
        if not FLIGHT_REGEX.match(clean):
            raise ValueError("Flight number must be formatted like 6E2134, AI506, UK812")
        return clean

    @field_validator("max_wait_min")
    @classmethod
    def validate_max_wait(cls, v: int) -> int:
        if v not in (15, 30, 60):
            raise ValueError("max_wait_min must be 15, 30, or 60")
        return v

    @field_validator("exact_address", "drop_detail", "dest_label", "area", "zone")
    @classmethod
    def strip_blank(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        return v or None

class RequestStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(landed|at_pickup|paid|done|cancel)$")

class RequestDelayUpdate(BaseModel):
    delay_min: int = Field(..., ge=0, le=720)

class ProposalCreate(BaseModel):
    member_request_ids: List[str]
    first_name: Optional[str] = Field(default=None, min_length=2, max_length=50)

class ProposalResponse(BaseModel):
    id: str
    initiator_request_id: str
    member_request_ids: List[str]
    status: str
    expires_at: datetime
    created_at: datetime
    responses: Dict[str, str]
    time_left_seconds: int

class ProposalAction(BaseModel):
    action: str = Field(..., pattern="^(accept|decline)$")
    first_name: Optional[str] = Field(default=None, min_length=2, max_length=50)

class CabNumberUpdate(BaseModel):
    cab_number: str

    @field_validator("cab_number")
    @classmethod
    def validate_cab(cls, v: str) -> str:
        clean = " ".join(v.upper().split())
        if not CAB_REGEX.match(clean):
            raise ValueError("Enter the number plate, like KA 01 AB 1234")
        return clean

class SettleBody(BaseModel):
    final_fare: float = Field(..., gt=0, le=20000)
    upi_id: Optional[str] = Field(default=None, max_length=64)

    @field_validator("upi_id")
    @classmethod
    def validate_upi(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not v.strip():
            return None
        v = v.strip()
        if not UPI_REGEX.match(v):
            raise ValueError("UPI ID looks like name@bank")
        return v

class MapsLinkBody(BaseModel):
    url: str = Field(..., min_length=8, max_length=2048)

class BookerUpdate(BaseModel):
    new_booker_request_id: str

class NoShowReport(BaseModel):
    target_request_id: str

class GroupMessageCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=200)

class GroupLinkResponse(BaseModel):
    uber_link: str
    trip_summary_text: str
    upi_links: Dict[str, str]

class ImpactMetrics(BaseModel):
    cabs_avoided: int
    km_saved: float
    co2_saved_kg: float
    trees_equivalent: float
    total_trips_matched: int
    active_pool_count: int
    avg_wait_min: float
    avg_saving_pct: float
    match_rate_pct: float
    wave_breakdown: List[Dict[str, Any]]
    zone_demand: Dict[str, int]
    assumptions_note: str

class GeoSearchResult(BaseModel):
    display_name: str
    lat: float
    lng: float
    zone: Optional[str]
