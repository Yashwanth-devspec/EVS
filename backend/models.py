"""
backend/models.py — SQLAlchemy 2 models for EcoRide Share.
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
import json

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime,
    ForeignKey, Text, Index
)
from sqlalchemy.orm import relationship

from backend.database import Base
from backend.config import CONFIG
from backend.clock import now, ensure_utc

class SessionRecord(Base):
    __tablename__ = "sessions"

    session_id = Column(String(64), primary_key=True, index=True)
    first_name = Column(String(64), nullable=False)
    completed_trips = Column(Integer, default=0, nullable=False)
    noshow_trips = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=now, nullable=False)
    last_seen_at = Column(DateTime, default=now, nullable=False)

    requests = relationship("PassengerRequest", back_populates="session", cascade="all, delete-orphan")

    @property
    def total_trips(self) -> int:
        return self.completed_trips + self.noshow_trips

    @property
    def reliability_score(self) -> Optional[float]:
        """Calculates reliability score (0-1.0) only after 3 completed/noshow trips."""
        if self.total_trips < 3:
            return None
        return round(self.completed_trips / self.total_trips, 2)


class PassengerRequest(Base):
    __tablename__ = "passenger_requests"

    id = Column(String(32), primary_key=True, index=True)
    session_id = Column(String(64), ForeignKey("sessions.session_id"), nullable=False, index=True)
    first_name = Column(String(64), nullable=False)
    flight_no = Column(String(16), nullable=False, index=True)
    arriving_from = Column(String(64), nullable=False)
    flight_kind = Column(String(16), nullable=False)  # domestic | international
    scheduled_arrival = Column(DateTime, nullable=False, index=True)
    delay_min = Column(Integer, default=0, nullable=False)
    terminal = Column(String(8), nullable=False)  # T1 | T2
    dest_lat = Column(Float, nullable=False)
    dest_lng = Column(Float, nullable=False)
    dest_label = Column(String(128), nullable=False)
    # zone holds the area label (reverse-geocoded neighbourhood or nearest known area).
    # Matching never reads it: it only uses dest_lat / dest_lng.
    zone = Column(String(64), nullable=False, index=True)
    accuracy = Column(String(8), default="area", nullable=False)  # address | pin | area
    # Private: only the person booking sees these, only after the group is confirmed.
    # Wiped when the trip ends or is cancelled, and never logged or put in a URL.
    exact_address = Column(String(256), nullable=True)
    drop_detail = Column(String(128), nullable=True)
    party_size = Column(Integer, default=1, nullable=False)  # 1-3
    checked_bags = Column(Integer, default=0, nullable=False)  # 0-3
    max_wait_min = Column(Integer, default=30, nullable=False)  # 15 | 30 | 60
    preferred_app = Column(String(32), default="any", nullable=False)  # uber | ola | rapido | namma_yatri | any
    women_only = Column(Boolean, default=False, nullable=False)  # self-declared
    
    # status: registered -> landed -> ready_at_pickup -> in_group -> completed | cancelled | expired
    status = Column(String(32), default="registered", nullable=False, index=True)
    # Where the traveller is on the day, independent of pool status:
    # waiting -> landed -> at_pickup -> paid -> done
    phase = Column(String(16), default="waiting", nullable=False)
    name_given = Column(Boolean, default=False, nullable=False)
    lock_until = Column(DateTime, nullable=True, index=True)
    created_at = Column(DateTime, default=now, nullable=False)
    landed_at = Column(DateTime, nullable=True)
    upi_id = Column(String(64), nullable=True)  # optional, group-scoped
    is_demo = Column(Boolean, default=False, nullable=False)

    session = relationship("SessionRecord", back_populates="requests")
    group_memberships = relationship("GroupMember", back_populates="request")

    def exit_buffer_min(self) -> int:
        key = f"{self.flight_kind}_{'checked' if self.checked_bags > 0 else 'cabin'}"
        return CONFIG.EXIT_BUFFER_MIN.get(key, 25)

    @property
    def ready_time(self) -> datetime:
        """Calculates expected pickup arrival: scheduled_arrival + delay_min + EXIT_BUFFER"""
        buffer = self.exit_buffer_min()
        sched = ensure_utc(self.scheduled_arrival)
        return sched + timedelta(minutes=self.delay_min + buffer)

    def wipe_private(self) -> None:
        self.exact_address = None
        self.drop_detail = None

    def is_locked(self, current_time: datetime) -> bool:
        if self.lock_until is None:
            return False
        return ensure_utc(self.lock_until) > ensure_utc(current_time)



class Proposal(Base):
    __tablename__ = "proposals"

    id = Column(String(32), primary_key=True, index=True)
    initiator_request_id = Column(String(32), ForeignKey("passenger_requests.id"), nullable=False)
    # Stored as JSON list of request IDs
    member_request_ids_json = Column(Text, nullable=False)
    # Stored as JSON dict of {request_id: "pending" | "accepted" | "declined"}
    responses_json = Column(Text, nullable=False)
    status = Column(String(16), default="open", nullable=False, index=True)  # open | accepted | declined | expired
    expires_at = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=now, nullable=False)

    @property
    def member_request_ids(self) -> List[str]:
        return json.loads(self.member_request_ids_json)

    @member_request_ids.setter
    def member_request_ids(self, val: List[str]):
        self.member_request_ids_json = json.dumps(val)

    @property
    def responses(self) -> Dict[str, str]:
        return json.loads(self.responses_json)

    @responses.setter
    def responses(self, val: Dict[str, str]):
        self.responses_json = json.dumps(val)


class Group(Base):
    __tablename__ = "groups"

    id = Column(String(32), primary_key=True, index=True)
    # status: confirmed | settling | completed | dissolved
    status = Column(String(16), default="confirmed", nullable=False, index=True)
    cab_number = Column(String(24), nullable=True)
    final_fare = Column(Float, nullable=True)
    booker_upi = Column(String(64), nullable=True)
    # JSON {request_id: rupees} recalculated from the actual fare
    final_shares_json = Column(Text, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)
    cab_type = Column(String(24), nullable=False)  # sedan | suv | tempo_traveller
    booker_request_id = Column(String(32), ForeignKey("passenger_requests.id"), nullable=False)
    # Stored as JSON list of request IDs in route drop order
    drop_order_json = Column(Text, nullable=False)
    shared_km = Column(Float, nullable=False)
    solo_km_sum = Column(Float, nullable=False)
    km_saved = Column(Float, nullable=False)
    co2_saved_kg = Column(Float, nullable=False)
    fare_total_est = Column(Float, nullable=False)
    pickup_code = Column(String(8), nullable=False)  # 4 digits
    share_token = Column(String(32), unique=True, nullable=False, index=True)
    depart_time = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=now, nullable=False)
    at_risk = Column(Boolean, default=False, nullable=False)
    at_risk_reason = Column(String(256), nullable=True)
    messages_json = Column(Text, default="[]", nullable=True)

    members = relationship("GroupMember", back_populates="group", cascade="all, delete-orphan")

    @property
    def messages(self) -> List[Dict[str, Any]]:
        return json.loads(self.messages_json) if self.messages_json else []

    @messages.setter
    def messages(self, val: List[Dict[str, Any]]):
        self.messages_json = json.dumps(val)

    @property
    def final_shares(self) -> Dict[str, int]:
        return json.loads(self.final_shares_json) if self.final_shares_json else {}

    @property
    def drop_order(self) -> List[str]:
        return json.loads(self.drop_order_json)

    @drop_order.setter
    def drop_order(self, val: List[str]):
        self.drop_order_json = json.dumps(val)


class GroupMember(Base):
    __tablename__ = "group_members"

    id = Column(Integer, primary_key=True, autoincrement=True)
    group_id = Column(String(32), ForeignKey("groups.id"), nullable=False, index=True)
    request_id = Column(String(32), ForeignKey("passenger_requests.id"), nullable=False, index=True)
    drop_index = Column(Integer, nullable=False)
    solo_km = Column(Float, nullable=False)
    shared_km_to_drop = Column(Float, nullable=False)
    detour_ratio = Column(Float, nullable=False)
    fare_share_est = Column(Float, nullable=False)
    solo_fare_est = Column(Float, nullable=False)
    extra_wait_min = Column(Integer, nullable=False)
    # outcome: active | completed | left | no_show
    outcome = Column(String(16), default="active", nullable=False)

    group = relationship("Group", back_populates="members")
    request = relationship("PassengerRequest", back_populates="group_memberships")


class JoinLink(Base):
    """A shareable /j/<token> link that pre-fills the airport and landing time for someone on the same flight."""
    __tablename__ = "join_links"

    token = Column(String(24), primary_key=True)
    scheduled_arrival = Column(DateTime, nullable=False)
    terminal = Column(String(8), nullable=False)
    flight_no = Column(String(16), nullable=True)
    created_at = Column(DateTime, default=now, nullable=False)


class DistanceCache(Base):
    __tablename__ = "distance_cache"

    id = Column(Integer, primary_key=True, autoincrement=True)
    origin_lat = Column(Float, nullable=False)
    origin_lng = Column(Float, nullable=False)
    dest_lat = Column(Float, nullable=False)
    dest_lng = Column(Float, nullable=False)
    distance_km = Column(Float, nullable=False)
    duration_sec = Column(Float, nullable=False)
    source = Column(String(32), default="osrm", nullable=False)  # osrm | haversine_fallback
    cached_at = Column(DateTime, default=now, nullable=False)

    __table_args__ = (
        Index("idx_dist_cache_coords", "origin_lat", "origin_lng", "dest_lat", "dest_lng"),
    )
