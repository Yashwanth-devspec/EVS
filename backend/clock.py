"""
backend/clock.py — Centralized clock service for EcoRide Share.
All time reads ("now") across backend models, matching, proposals, and APIs
MUST go through this service. Enables demo mode time travel and simulation.
"""
from datetime import datetime, timezone, timedelta
from typing import Optional

class ClockService:
    def __init__(self):
        # Base offset in seconds added to system UTC time
        self._offset_seconds: float = 0.0
        # Optional frozen override time (useful for deterministic tests)
        self._frozen_time: Optional[datetime] = None

    def now_utc(self) -> datetime:
        """Returns the current simulated UTC datetime with timezone info."""
        if self._frozen_time is not None:
            return self._frozen_time
        return datetime.now(timezone.utc) + timedelta(seconds=self._offset_seconds)

    def advance_minutes(self, minutes: int = 10) -> datetime:
        """Fast-forwards simulated time by specified minutes."""
        if self._frozen_time is not None:
            self._frozen_time += timedelta(minutes=minutes)
            return self._frozen_time
        self._offset_seconds += minutes * 60.0
        return self.now_utc()

    def set_frozen_time(self, dt: datetime) -> None:
        """Freezes clock at exact UTC datetime."""
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        self._frozen_time = dt

    def reset(self) -> None:
        """Resets the clock back to real system time."""
        self._offset_seconds = 0.0
        self._frozen_time = None

    def get_offset_minutes(self) -> float:
        """Returns the current offset in minutes."""
        return self._offset_seconds / 60.0

# Singleton instance
CLOCK = ClockService()

def now() -> datetime:
    """Convenience helper for CLOCK.now_utc()"""
    return CLOCK.now_utc()

def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Ensures datetime is timezone-aware UTC."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

