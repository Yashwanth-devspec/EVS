"""
backend/main.py — FastAPI application for EcoRide Share.
Anonymous sessions, matching on real drop coordinates, invites and locks, the single
server-derived trip state (/trip), privacy-filtered group views, geocoding and map-tile
proxies (no third-party URL reaches the browser), impact analytics and demo controls.
"""
import os
import re
import uuid
import json
import asyncio
import hashlib
import logging
import secrets
from datetime import timedelta
from typing import Optional, Dict, Any

from fastapi import (
    FastAPI, Depends, HTTPException,
    Request, Response, Header, Query
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from contextlib import asynccontextmanager
from backend.config import CONFIG, get_public_config
from backend.database import get_db, init_db, SessionLocal
from backend.models import (
    SessionRecord, PassengerRequest, Proposal, Group, GroupMember, JoinLink
)
from backend.schemas import (
    SessionCreate, SessionResponse, RequestCreate, RequestStatusUpdate,
    RequestDelayUpdate, ProposalCreate, ProposalResponse, ProposalAction,
    BookerUpdate, NoShowReport, GroupLinkResponse, ImpactMetrics,
    CabNumberUpdate, SettleBody, MapsLinkBody, GroupMessageCreate,
)
from backend.clock import CLOCK, now, ensure_utc
from backend.distance import offline_mode
from backend.matching import (
    find_matching_options, evaluate_group, generate_uber_link,
    redact_group_for_viewer, split_fare_whole_rupees,
)
from backend.demo_data import seed_demo_passengers, reset_all
from backend import geo
from backend import trip as trip_state

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ecoride.api")


class _StripQueryStrings(logging.Filter):
    """Access logs keep the path but drop query strings, so search text and pin coordinates never reach a log."""

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.args, tuple) and len(record.args) >= 3 and isinstance(record.args[2], str):
            args = list(record.args)
            args[2] = args[2].split("?", 1)[0]
            record.args = tuple(args)
        return True


logging.getLogger("uvicorn.access").addFilter(_StripQueryStrings())
# httpx logs every outbound URL at INFO, which would include search text and pin coordinates.
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    db = SessionLocal()
    count = db.query(PassengerRequest).count()
    if count == 0:
        logger.info("Database empty on startup. Automatically seeding demo passengers...")
        seed_demo_passengers(db, now())
    db.close()
    worker_task = asyncio.create_task(background_worker())
    yield
    worker_task.cancel()

app = FastAPI(
    title="EcoRide Share API",
    description="Platform-only airport cab-sharing matching engine for BLR",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SESSION_COOKIE_NAME = "ecoride_session"
SESSION_ID_PATTERN = re.compile(r"^sess_[A-Za-z0-9_\-]{6,48}$")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "ecoride2026")
ACTIVE_POOL = trip_state.ACTIVE_POOL


# -----------------------------------------------------------------------------
# Sessions
# -----------------------------------------------------------------------------
def supplied_session_id(request: Request) -> Optional[str]:
    """An explicit X-Session-ID header wins over the cookie (each demo phone frame carries its own)."""
    return request.headers.get("X-Session-ID") or request.cookies.get(SESSION_COOKIE_NAME)


def find_session(request: Request, db: Session) -> Optional[SessionRecord]:
    sid = supplied_session_id(request)
    if not sid:
        return None
    return db.query(SessionRecord).filter(SessionRecord.session_id == sid).first()


def ensure_session(request: Request, db: Session, first_name: Optional[str] = None) -> SessionRecord:
    """Returns the caller's session, creating it (with the id they supplied, if well-formed) when missing."""
    sess = find_session(request, db)
    if sess:
        sess.last_seen_at = now()
        if first_name:
            sess.first_name = first_name
        db.commit()
        return sess
    sid = supplied_session_id(request)
    if not sid or not SESSION_ID_PATTERN.match(sid):
        sid = f"sess_{uuid.uuid4().hex[:16]}"
    sess = SessionRecord(
        session_id=sid,
        first_name=first_name or "Traveller",
        created_at=now(),
        last_seen_at=now()
    )
    db.add(sess)
    db.commit()
    db.refresh(sess)
    return sess


def set_session_cookie(response: Response, session_id: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_id,
        httponly=True,
        samesite="lax",
        max_age=86400 * 7
    )


def get_current_session(request: Request, db: Session = Depends(get_db)) -> SessionRecord:
    return ensure_session(request, db)


def latest_request(db: Session, session_id: str) -> Optional[PassengerRequest]:
    return db.query(PassengerRequest).filter(
        PassengerRequest.session_id == session_id
    ).order_by(PassengerRequest.created_at.desc()).first()


def owned_request(request: Request, db: Session, request_id: str) -> PassengerRequest:
    p_req = db.query(PassengerRequest).filter(PassengerRequest.id == request_id).first()
    if not p_req:
        raise HTTPException(status_code=404, detail="Request not found")
    sess = find_session(request, db)
    if not sess or sess.session_id != p_req.session_id:
        raise HTTPException(status_code=403, detail="This trip belongs to someone else.")
    return p_req


def viewer_in_group(request: Request, db: Session, group_id: str):
    grp = db.query(Group).filter(Group.id == group_id).first()
    if not grp:
        raise HTTPException(status_code=404, detail="Group not found")
    sess = find_session(request, db)
    viewer = None
    if sess:
        member_ids = [m.request_id for m in db.query(GroupMember).filter(GroupMember.group_id == grp.id).all()]
        viewer = db.query(PassengerRequest).filter(
            PassengerRequest.session_id == sess.session_id,
            PassengerRequest.id.in_(member_ids),
        ).order_by(PassengerRequest.created_at.desc()).first()
    if viewer is None:
        raise HTTPException(status_code=403, detail="Only people in this group can see it.")
    return grp, viewer


def clean_name(name: str) -> str:
    return " ".join(name.strip().split())[:50]


# -----------------------------------------------------------------------------
# Group formation, leaving and completion
# -----------------------------------------------------------------------------
def release_locks(db: Session, prop: Proposal) -> None:
    for r in db.query(PassengerRequest).filter(PassengerRequest.id.in_(prop.member_request_ids)).all():
        if r.status != "in_group":
            r.lock_until = None


def form_group(db: Session, prop: Proposal) -> Optional[Group]:
    """Everyone said yes: turn the proposal into a confirmed group, booked by whoever sent the invite."""
    curr_time = now()
    member_reqs = db.query(PassengerRequest).filter(PassengerRequest.id.in_(prop.member_request_ids)).all()
    initiator_req = next((r for r in member_reqs if r.id == prop.initiator_request_id), member_reqs[0])
    mg = evaluate_group(initiator_req, member_reqs, db)
    if not mg:
        prop.status = "expired"
        release_locks(db, prop)
        return None
    new_group = Group(
        id=f"grp_{uuid.uuid4().hex[:10]}",
        status="confirmed",
        cab_type=mg.cab_type,
        booker_request_id=initiator_req.id,
        drop_order=mg.drop_order,
        shared_km=mg.shared_km,
        solo_km_sum=mg.solo_km_sum,
        km_saved=mg.km_saved,
        co2_saved_kg=mg.co2_saved_kg,
        fare_total_est=mg.fare_total_est,
        pickup_code=f"{secrets.randbelow(9000) + 1000}",
        share_token=f"blr-{uuid.uuid4().hex[:8]}",
        depart_time=mg.depart_time,
        created_at=curr_time,
        updated_at=curr_time,
    )
    db.add(new_group)
    db.flush()
    for mem in mg.members:
        db.add(GroupMember(
            group_id=new_group.id,
            request_id=mem.request_id,
            drop_index=mem.drop_index,
            solo_km=mem.solo_km,
            shared_km_to_drop=mem.shared_km_to_drop,
            detour_ratio=mem.detour_ratio,
            fare_share_est=mem.fare_share_est,
            solo_fare_est=mem.solo_fare_est,
            extra_wait_min=mem.extra_wait_min,
            outcome="active"
        ))
        req_obj = next((r for r in member_reqs if r.id == mem.request_id), None)
        if req_obj:
            req_obj.status = "in_group"
            req_obj.lock_until = None
    prop.status = "accepted"
    return new_group


def leave_current_group(db: Session, p_req: PassengerRequest) -> Optional[Group]:
    mem = db.query(GroupMember).filter(GroupMember.request_id == p_req.id, GroupMember.outcome == "active").first()
    if not mem:
        return None
    grp = db.query(Group).filter(Group.id == mem.group_id).first()
    mem.outcome = "left"
    db.flush()
    remaining = db.query(GroupMember).filter(GroupMember.group_id == grp.id, GroupMember.outcome == "active").all()
    if len(remaining) < 2:
        grp.status = "dissolved"
        for r_mem in remaining:
            r_req = db.query(PassengerRequest).filter(PassengerRequest.id == r_mem.request_id).first()
            if r_req:
                r_req.status = "registered"
                r_req.phase = "waiting"
    else:
        req_ids = [m.request_id for m in remaining]
        reqs = db.query(PassengerRequest).filter(PassengerRequest.id.in_(req_ids)).all()
        if grp.booker_request_id == p_req.id:
            grp.booker_request_id = reqs[0].id
        booker = next(r for r in reqs if r.id == grp.booker_request_id)
        mg = evaluate_group(booker, reqs, db)
        if mg:
            grp.shared_km = mg.shared_km
            grp.solo_km_sum = mg.solo_km_sum
            grp.km_saved = mg.km_saved
            grp.co2_saved_kg = mg.co2_saved_kg
            grp.fare_total_est = mg.fare_total_est
            grp.cab_type = mg.cab_type
            grp.drop_order = mg.drop_order
            for m in mg.members:
                g_mem = next((gm for gm in remaining if gm.request_id == m.request_id), None)
                if g_mem:
                    g_mem.fare_share_est = m.fare_share_est
                    g_mem.drop_index = m.drop_index
    grp.updated_at = now()
    return grp


def complete_group(db: Session, grp: Group) -> None:
    """The trip is over: private address fields of every member are deleted with it."""
    grp.status = "completed"
    grp.completed_at = now()
    grp.updated_at = now()
    for m in db.query(GroupMember).filter(GroupMember.group_id == grp.id).all():
        r = db.query(PassengerRequest).filter(PassengerRequest.id == m.request_id).first()
        if r:
            r.wipe_private()
            if m.outcome == "active":
                m.outcome = "completed"
                if r.session and r.phase in ("paid", "done"):
                    r.session.completed_trips += 1


def trip_response(db: Session, session_id: str) -> Dict[str, Any]:
    db.expire_all()
    return trip_state.build_trip(db, session_id)


# -----------------------------------------------------------------------------
# Background worker: invite expiry, demo travellers, 24-hour purge
# -----------------------------------------------------------------------------
def demo_reply_delay_sec(prop_id: str, req_id: str) -> float:
    """Each demo traveller answers 3 to 6 seconds after an invite, deterministically per invite."""
    h = int(hashlib.sha1(f"{prop_id}:{req_id}".encode()).hexdigest()[:6], 16)
    return 3.0 + (h % 3001) / 1000.0


def process_open_proposals(db: Session) -> None:
    curr_time = ensure_utc(now())
    for prop in db.query(Proposal).filter(Proposal.status == "open").all():
        if curr_time > ensure_utc(prop.expires_at):
            prop.status = "expired"
            release_locks(db, prop)
            continue
        age = (curr_time - ensure_utc(prop.created_at)).total_seconds()
        resp_dict = prop.responses
        changed = False
        for req_id in prop.member_request_ids:
            if resp_dict.get(req_id) != "pending":
                continue
            if age < demo_reply_delay_sec(prop.id, req_id):
                continue
            mem_req = db.query(PassengerRequest).filter(PassengerRequest.id == req_id).first()
            if mem_req and (mem_req.is_demo or mem_req.session_id.startswith("sess_demo_")):
                resp_dict[req_id] = "accepted"
                changed = True
        if changed:
            prop.responses = resp_dict
            if all(v == "accepted" for v in resp_dict.values()):
                form_group(db, prop)
    db.commit()


def process_demo_bookers(db: Session) -> None:
    """When a demo traveller is the one booking, they book and settle up a few seconds after you reach them."""
    curr_time = ensure_utc(now())
    for grp in db.query(Group).filter(Group.status.in_(["confirmed", "settling"])).all():
        booker = db.query(PassengerRequest).filter(PassengerRequest.id == grp.booker_request_id).first()
        if not booker or not booker.is_demo:
            continue
        member_ids = [m.request_id for m in db.query(GroupMember).filter(
            GroupMember.group_id == grp.id, GroupMember.outcome == "active").all()]
        humans = db.query(PassengerRequest).filter(
            PassengerRequest.id.in_(member_ids), PassengerRequest.is_demo == False  # noqa: E712
        ).all()
        idle = (curr_time - ensure_utc(grp.updated_at or grp.created_at)).total_seconds()
        if not grp.cab_number and any(h.phase == "at_pickup" for h in humans) and idle >= 4:
            grp.cab_number = "KA 05 MX 4821"
            grp.updated_at = curr_time
        elif grp.cab_number and grp.final_fare is None and idle >= 6:
            members = db.query(GroupMember).filter(GroupMember.group_id == grp.id, GroupMember.outcome == "active").all()
            reqs = {r.id: r for r in db.query(PassengerRequest).filter(PassengerRequest.id.in_(member_ids)).all()}
            fare = round(grp.fare_total_est * 1.04 / 10) * 10
            grp.final_fare = fare
            grp.status = "settling"
            grp.final_shares_json = json.dumps(split_fare_whole_rupees(
                fare, [(m.request_id, reqs[m.request_id].party_size, m.solo_km) for m in members]
            ))
            grp.updated_at = curr_time
    db.commit()


def purge_expired(db: Session) -> int:
    """Real (non-demo) trips are deleted 24 hours after they were created."""
    cutoff = now() - timedelta(hours=CONFIG.PURGE_AFTER_HOURS)
    old = db.query(PassengerRequest).filter(
        PassengerRequest.is_demo == False,  # noqa: E712
        PassengerRequest.created_at < cutoff,
    ).all()
    if not old:
        return 0
    ids = [r.id for r in old]
    group_ids = {m.group_id for m in db.query(GroupMember).filter(GroupMember.request_id.in_(ids)).all()}
    db.query(GroupMember).filter(GroupMember.request_id.in_(ids)).delete(synchronize_session=False)
    for p in db.query(Proposal).all():
        if any(i in p.member_request_ids for i in ids):
            db.delete(p)
    for r in old:
        db.delete(r)
    db.flush()
    for gid in group_ids:
        if db.query(GroupMember).filter(GroupMember.group_id == gid).count() == 0:
            db.query(Group).filter(Group.id == gid).delete(synchronize_session=False)
    db.query(JoinLink).filter(JoinLink.created_at < cutoff).delete(synchronize_session=False)
    db.commit()
    return len(ids)


async def background_worker():
    ticks = 0
    while True:
        try:
            await asyncio.sleep(1.0)
            db = SessionLocal()
            try:
                process_open_proposals(db)
                process_demo_bookers(db)
                ticks += 1
                if ticks % 60 == 0:
                    purge_expired(db)
                # Release expired request locks
                curr_time = ensure_utc(now())
                for r in db.query(PassengerRequest).filter(
                    PassengerRequest.lock_until != None,  # noqa: E711
                    PassengerRequest.status != "in_group"
                ).all():
                    if ensure_utc(r.lock_until) < curr_time:
                        r.lock_until = None
                db.commit()
            finally:
                db.close()
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error(f"Error in background worker: {e}")
            await asyncio.sleep(2.0)


# -----------------------------------------------------------------------------
# Health and config
# -----------------------------------------------------------------------------
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "EcoRide Share Backend",
        "clock_simulated_utc": now().isoformat(),
        "clock_offset_minutes": CLOCK.get_offset_minutes()
    }


@app.get("/config")
def get_config():
    """Exposes configuration and all labelled assumptions to frontend."""
    return get_public_config()


# -----------------------------------------------------------------------------
# Sessions and trip requests
# -----------------------------------------------------------------------------
@app.post("/session", response_model=SessionResponse)
def create_or_identify_session(
    body: SessionCreate,
    response: Response,
    request: Request,
    db: Session = Depends(get_db)
):
    """Establishes or updates an anonymous passenger session."""
    sess = ensure_session(request, db, clean_name(body.first_name))
    set_session_cookie(response, sess.session_id)
    return SessionResponse(
        session_id=sess.session_id,
        first_name=sess.first_name,
        completed_trips=sess.completed_trips,
        noshow_trips=sess.noshow_trips,
        reliability_score=sess.reliability_score
    )


def out_of_range_response(lat: float, lng: float, area: str) -> JSONResponse:
    term = CONFIG.TERMINALS["T1"]
    return JSONResponse(status_code=422, content={"detail": {
        "code": "out_of_range",
        "message": geo.OUT_OF_RANGE_MESSAGE,
        "distance_from_airport_km": round(geo.airport_distance_km(lat, lng), 1),
        "service_radius_km": CONFIG.SERVICE_RADIUS_KM,
        "solo_link": generate_uber_link(term.lat, term.lng, term.pickup_nickname, lat, lng, area),
    }})


@app.post("/requests")
def create_passenger_request(
    body: RequestCreate,
    response: Response,
    request: Request,
    db: Session = Depends(get_db)
):
    """Creates a new active trip for the caller. Only where and when are required."""
    if not body.adult_confirmed:
        raise HTTPException(status_code=422, detail="Please confirm you're 18 or older, or travelling with an adult.")

    area = body.area or body.zone or geo.nearest_area(body.dest_lat, body.dest_lng)
    if not geo.in_service_range(body.dest_lat, body.dest_lng):
        return out_of_range_response(body.dest_lat, body.dest_lng, area)

    name = clean_name(body.first_name) if body.first_name else None
    sess = ensure_session(request, db, name)
    set_session_cookie(response, sess.session_id)

    # One active trip per session: earlier ones are cancelled (and a confirmed group is left).
    for r in db.query(PassengerRequest).filter(
        PassengerRequest.session_id == sess.session_id,
        PassengerRequest.status.in_(trip_state.ACTIVE_ANY)
    ).all():
        if r.status == "in_group":
            leave_current_group(db, r)
        r.status = "cancelled"
        r.lock_until = None
        r.wipe_private()

    if sess.session_id.startswith("sess_demo_you"):
        for r in db.query(PassengerRequest).filter(
            PassengerRequest.session_id.startswith("sess_demo_you"),
            PassengerRequest.session_id != sess.session_id,
            PassengerRequest.status.in_(trip_state.ACTIVE_ANY)
        ).all():
            r.status = "cancelled"
            r.lock_until = None
            r.wipe_private()

    name_given = bool(name) or sess.first_name not in ("Traveller", "Passenger")
    req_id = f"req_{uuid.uuid4().hex[:10]}"
    p_req = PassengerRequest(
        id=req_id,
        session_id=sess.session_id,
        first_name=name or sess.first_name,
        name_given=name_given,
        flight_no=body.flight_no or "",
        arriving_from=(body.arriving_from or "").strip(),
        flight_kind=body.flight_kind,
        scheduled_arrival=body.scheduled_arrival,
        delay_min=body.delay_min,
        terminal=body.terminal,
        dest_lat=body.dest_lat,
        dest_lng=body.dest_lng,
        dest_label=body.dest_label or area,
        zone=area,
        accuracy=body.accuracy,
        exact_address=body.exact_address,
        drop_detail=body.drop_detail,
        party_size=body.party_size,
        checked_bags=body.checked_bags,
        max_wait_min=body.max_wait_min,
        preferred_app=body.preferred_app,
        women_only=body.women_only,
        status="registered",
        phase="waiting",
        created_at=now(),
        upi_id=body.upi_id
    )
    db.add(p_req)
    db.commit()
    db.refresh(p_req)

    return {
        "id": p_req.id,
        "session_id": sess.session_id,
        "first_name": p_req.first_name,
        "status": p_req.status,
        "area": p_req.zone,
        "ready_time": p_req.ready_time.isoformat(),
        "exit_buffer_min": p_req.exit_buffer_min()
    }


@app.get("/requests/me")
def get_my_active_request(
    request: Request,
    db: Session = Depends(get_db)
):
    """Returns the viewer's current active request."""
    session = get_current_session(request, db)
    p_req = trip_state.active_request(db, session.session_id)
    session_view = {
        "session_id": session.session_id,
        "first_name": session.first_name,
        "completed_trips": session.completed_trips,
        "noshow_trips": session.noshow_trips,
        "reliability_score": session.reliability_score
    }
    if not p_req:
        return {"request": None, "session": session_view}
    membership = trip_state.active_membership(db, p_req) if p_req.status == "in_group" else None
    return {
        "request": trip_state.own_request_view(p_req, membership.group_id if membership else None),
        "session": session_view,
    }


@app.get("/trip")
def get_trip(request: Request, db: Session = Depends(get_db)):
    """The one trip state the Trip screen renders. A refresh always resumes from here."""
    sess = find_session(request, db)
    return trip_state.build_trip(db, sess.session_id if sess else None)


@app.post("/trip/new")
def start_new_trip(request: Request, db: Session = Depends(get_db)):
    """Closes the finished (or abandoned) trip so the Trip screen returns to the start."""
    sess = find_session(request, db)
    if not sess:
        return trip_state.build_trip(db, None)
    p_req = trip_state.active_request(db, sess.session_id)
    if p_req:
        if p_req.status == "in_group" and p_req.phase not in ("paid", "done"):
            leave_current_group(db, p_req)
        p_req.status = "completed" if p_req.phase in ("paid", "done") else "cancelled"
        p_req.lock_until = None
        p_req.wipe_private()
        db.commit()
    return trip_response(db, sess.session_id)


@app.patch("/requests/{id}/status")
def update_request_status(
    id: str,
    body: RequestStatusUpdate,
    request: Request,
    db: Session = Depends(get_db)
):
    """Updates where the traveller is: landed, at_pickup, paid, done, or cancel."""
    p_req = owned_request(request, db, id)
    in_group = p_req.status == "in_group"

    if body.status == "landed":
        p_req.phase = "landed"
        p_req.landed_at = now()
        if not in_group:
            p_req.status = "landed"
    elif body.status == "at_pickup":
        p_req.phase = "at_pickup"
        if not in_group:
            p_req.status = "ready_at_pickup"
    elif body.status in ("paid", "done"):
        if not in_group:
            raise HTTPException(status_code=400, detail="There's no shared cab to settle yet.")
        p_req.phase = body.status
        p_req.wipe_private()
        mem = trip_state.active_membership(db, p_req)
        grp = db.query(Group).filter(Group.id == mem.group_id).first() if mem else None
        if grp and grp.booker_request_id == p_req.id and body.status == "done":
            complete_group(db, grp)
    elif body.status == "cancel":
        if in_group:
            leave_current_group(db, p_req)
        p_req.status = "cancelled"
        p_req.lock_until = None
        p_req.wipe_private()

    db.commit()
    return {"id": p_req.id, "status": p_req.status, "phase": p_req.phase, "ready_time": p_req.ready_time.isoformat()}


@app.patch("/requests/{id}/delay")
def update_request_delay(
    id: str,
    body: RequestDelayUpdate,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Updates reported delay, recomputes ready_time, and revalidates any active groups.
    If constraints break, flags group 'at risk'.
    """
    p_req = owned_request(request, db, id)
    p_req.delay_min = body.delay_min
    db.commit()

    for prop in db.query(Proposal).filter(
        Proposal.status == "open",
        Proposal.member_request_ids_json.contains(p_req.id)
    ).all():
        all_mems = db.query(PassengerRequest).filter(PassengerRequest.id.in_(prop.member_request_ids)).all()
        if not evaluate_group(all_mems[0], all_mems, db):
            prop.status = "declined"
            for m in all_mems:
                m.lock_until = None

    group_at_risk = False
    at_risk_reason = None
    membership = trip_state.active_membership(db, p_req)
    if membership:
        grp = db.query(Group).filter(Group.id == membership.group_id).first()
        if grp and grp.status == "confirmed":
            req_ids = [m.request_id for m in db.query(GroupMember).filter(
                GroupMember.group_id == grp.id, GroupMember.outcome == "active").all()]
            reqs = db.query(PassengerRequest).filter(PassengerRequest.id.in_(req_ids)).all()
            initiator = next((r for r in reqs if r.id == grp.booker_request_id), reqs[0])
            mg = evaluate_group(initiator, reqs, db)
            if not mg:
                grp.at_risk = True
                grp.at_risk_reason = f"{p_req.first_name}'s flight is {body.delay_min} minutes late, longer than everyone agreed to wait."
                group_at_risk = True
                at_risk_reason = grp.at_risk_reason
            else:
                grp.depart_time = mg.depart_time
                grp.at_risk = False
                grp.at_risk_reason = None

    db.commit()
    return {
        "id": p_req.id,
        "delay_min": p_req.delay_min,
        "ready_time": p_req.ready_time.isoformat(),
        "group_at_risk": group_at_risk,
        "at_risk_reason": at_risk_reason
    }


@app.get("/requests/{id}/options")
def get_matching_options(
    id: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """Tiered options (NOW, SOON, LATER) and the solo baseline. Other travellers are redacted."""
    viewer_req = owned_request(request, db, id)
    all_reqs = db.query(PassengerRequest).filter(PassengerRequest.status.in_(ACTIVE_POOL)).all()
    res = find_matching_options(viewer_req, all_reqs, now(), db).model_dump(mode="json")
    res["tiers"] = {k: (redact_group_for_viewer(v, viewer_req) if v else None) for k, v in res["tiers"].items()}
    res["all_valid_groups"] = [redact_group_for_viewer(g, viewer_req) for g in res["all_valid_groups"]]
    return res


@app.get("/pool/outlook")
def get_pool_outlook(db: Session = Depends(get_db)):
    """Counts of upcoming travellers by area and 15-minute wave over the next 90 minutes."""
    curr = ensure_utc(now())
    horizon = curr + timedelta(minutes=90)
    active_requests = db.query(PassengerRequest).filter(PassengerRequest.status.in_(ACTIVE_POOL)).all()

    zone_counts: Dict[str, int] = {}
    wave_counts: Dict[str, int] = {}
    for r in active_requests:
        r_ready = r.ready_time
        if curr - timedelta(minutes=20) <= r_ready <= horizon:
            zone_counts[r.zone] = zone_counts.get(r.zone, 0) + 1
            mins_from_now = int((r_ready - curr).total_seconds() / 60.0)
            bucket_idx = max(0, mins_from_now // 15)
            bucket_label = f"+{bucket_idx * 15} to +{(bucket_idx + 1) * 15} min"
            wave_counts[bucket_label] = wave_counts.get(bucket_label, 0) + 1

    total_pool = len(active_requests)
    return {
        "total_active_pool": total_pool,
        "summary": f"{total_pool} travellers heading into Bengaluru in the next 90 minutes.",
        "by_zone": zone_counts,
        "by_wave": wave_counts
    }


# -----------------------------------------------------------------------------
# Invites
# -----------------------------------------------------------------------------
def set_first_name(db: Session, p_req: PassengerRequest, first_name: Optional[str]) -> None:
    if first_name:
        name = clean_name(first_name)
        p_req.first_name = name
        p_req.name_given = True
        if p_req.session:
            p_req.session.first_name = name


@app.post("/proposals", response_model=ProposalResponse)
def create_proposal(
    body: ProposalCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    """Invites the chosen travellers to share. Everyone involved is held for the reply window."""
    session = get_current_session(request, db)
    initiator_req = db.query(PassengerRequest).filter(
        PassengerRequest.session_id == session.session_id,
        PassengerRequest.status.in_(ACTIVE_POOL)
    ).order_by(PassengerRequest.created_at.desc()).first()
    if not initiator_req:
        raise HTTPException(status_code=400, detail="No active request found for initiator.")
    set_first_name(db, initiator_req, body.first_name)

    member_ids = list(dict.fromkeys([initiator_req.id] + body.member_request_ids))
    if len(member_ids) < 2 or len(member_ids) > 4:
        raise HTTPException(status_code=400, detail="A group must consist of 2 to 4 passenger requests.")

    curr_time = now()
    members = db.query(PassengerRequest).filter(PassengerRequest.id.in_(member_ids)).all()
    if len(members) != len(member_ids):
        raise HTTPException(status_code=400, detail="One or more member requests do not exist.")
    for m in members:
        if m.status not in ACTIVE_POOL:
            raise HTTPException(status_code=400, detail=f"{m.first_name} is no longer available.")
        if m.is_locked(curr_time) and m.id != initiator_req.id:
            raise HTTPException(status_code=409, detail=f"{m.first_name} is currently considering another proposal.")

    is_demo_involved = any(m.is_demo for m in members)
    win_min = CONFIG.DEMO_CONFIRM_WINDOW_MIN if is_demo_involved else CONFIG.CONFIRM_WINDOW_MIN
    expires_at = curr_time + timedelta(minutes=win_min)
    for m in members:
        m.lock_until = expires_at

    resp_dict = {m_id: ("accepted" if m_id == initiator_req.id else "pending") for m_id in member_ids}
    prop = Proposal(
        id=f"prop_{uuid.uuid4().hex[:10]}",
        initiator_request_id=initiator_req.id,
        member_request_ids_json=json.dumps(member_ids),
        responses_json=json.dumps(resp_dict),
        status="open",
        expires_at=expires_at,
        created_at=curr_time
    )
    db.add(prop)
    db.commit()
    db.refresh(prop)

    return ProposalResponse(
        id=prop.id,
        initiator_request_id=prop.initiator_request_id,
        member_request_ids=prop.member_request_ids,
        status=prop.status,
        expires_at=prop.expires_at,
        created_at=prop.created_at,
        responses=prop.responses,
        time_left_seconds=max(0, int((ensure_utc(prop.expires_at) - ensure_utc(curr_time)).total_seconds()))
    )


@app.get("/proposals/inbox")
def get_proposals_inbox(request: Request, db: Session = Depends(get_db)):
    """Open invites involving the current user (first names and areas only)."""
    session = get_current_session(request, db)
    p_req = latest_request(db, session.session_id)
    if not p_req:
        return {"proposals": []}
    curr_time = now()
    inbox = []
    for prop in db.query(Proposal).filter(
        Proposal.member_request_ids_json.contains(p_req.id),
        Proposal.status == "open"
    ).all():
        mem_reqs = db.query(PassengerRequest).filter(PassengerRequest.id.in_(prop.member_request_ids)).all()
        inbox.append({
            "id": prop.id,
            "initiator_request_id": prop.initiator_request_id,
            "status": prop.status,
            "expires_at": ensure_utc(prop.expires_at).isoformat(),
            "time_left_seconds": max(0, int((ensure_utc(prop.expires_at) - ensure_utc(curr_time)).total_seconds())),
            "responses": prop.responses,
            "members": [{"first_name": m.first_name, "zone": m.zone, "id": m.id} for m in mem_reqs],
            "my_response": prop.responses.get(p_req.id, "pending")
        })
    return {"proposals": inbox}


@app.post("/proposals/{id}/respond")
def respond_to_proposal(
    id: str,
    body: ProposalAction,
    request: Request,
    db: Session = Depends(get_db)
):
    """A member accepts or declines. When everyone has accepted the group is confirmed."""
    session = get_current_session(request, db)
    prop = db.query(Proposal).filter(Proposal.id == id).first()
    if not prop or prop.status != "open":
        raise HTTPException(status_code=404, detail="This invite has ended.")
    curr_time = ensure_utc(now())
    if curr_time > ensure_utc(prop.expires_at):
        prop.status = "expired"
        release_locks(db, prop)
        db.commit()
        raise HTTPException(status_code=404, detail="This invite has expired.")
    p_req = db.query(PassengerRequest).filter(
        PassengerRequest.session_id == session.session_id,
        PassengerRequest.id.in_(prop.member_request_ids),
    ).first()
    if not p_req:
        raise HTTPException(status_code=403, detail="You are not a member of this proposal.")
    set_first_name(db, p_req, body.first_name)

    resp_dict = prop.responses
    resp_dict[p_req.id] = "accepted" if body.action == "accept" else "declined"
    prop.responses = resp_dict

    created_group_id = None
    if body.action == "decline":
        prop.status = "declined"
        release_locks(db, prop)
    elif all(v == "accepted" for v in resp_dict.values()):
        grp = form_group(db, prop)
        created_group_id = grp.id if grp else None

    db.commit()
    return {
        "proposal_id": prop.id,
        "status": prop.status,
        "responses": prop.responses,
        "group_id": created_group_id
    }


@app.post("/proposals/{id}/cancel")
def cancel_proposal(id: str, request: Request, db: Session = Depends(get_db)):
    """The person who sent the invite takes it back."""
    sess = find_session(request, db)
    prop = db.query(Proposal).filter(Proposal.id == id).first()
    if not prop or prop.status != "open":
        raise HTTPException(status_code=404, detail="This invite has ended.")
    initiator = db.query(PassengerRequest).filter(PassengerRequest.id == prop.initiator_request_id).first()
    if not sess or not initiator or initiator.session_id != sess.session_id:
        raise HTTPException(status_code=403, detail="Only the person who sent the invite can cancel it.")
    prop.status = "cancelled"
    release_locks(db, prop)
    db.commit()
    return trip_response(db, sess.session_id)


# -----------------------------------------------------------------------------
# Groups (members only; addresses only for the person booking)
# -----------------------------------------------------------------------------
@app.get("/groups/{id}")
def get_group_details(id: str, request: Request, db: Session = Depends(get_db)):
    grp, viewer = viewer_in_group(request, db, id)
    return trip_state.group_view(db, grp, viewer)


def booker_only(grp: Group, viewer: PassengerRequest) -> None:
    if grp.booker_request_id != viewer.id:
        raise HTTPException(status_code=403, detail="Only the person booking the cab can do this.")


@app.post("/groups/{id}/booker")
def update_group_booker(id: str, body: BookerUpdate, request: Request, db: Session = Depends(get_db)):
    """The person booking hands the job to someone else in the group."""
    grp, viewer = viewer_in_group(request, db, id)
    booker_only(grp, viewer)
    mem = db.query(GroupMember).filter(
        GroupMember.group_id == grp.id,
        GroupMember.request_id == body.new_booker_request_id,
        GroupMember.outcome == "active",
    ).first()
    if not mem:
        raise HTTPException(status_code=400, detail="Target request is not a group member.")
    grp.booker_request_id = body.new_booker_request_id
    grp.updated_at = now()
    db.commit()
    return {"group_id": grp.id, "booker_request_id": grp.booker_request_id}


@app.post("/groups/{id}/leave")
def leave_group(id: str, request: Request, db: Session = Depends(get_db)):
    grp, viewer = viewer_in_group(request, db, id)
    leave_current_group(db, viewer)
    viewer.status = "registered"
    viewer.phase = "waiting"
    db.commit()
    return {"message": "Left group successfully", "group_status": grp.status}


@app.post("/groups/{id}/messages")
def send_group_message(id: str, body: GroupMessageCreate, request: Request, db: Session = Depends(get_db)):
    """In-trip coordination for confirmed group members at the airport."""
    grp, viewer = viewer_in_group(request, db, id)
    clean_text = body.text.strip()
    if not clean_text:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    curr = ensure_utc(now())
    msg_id = f"msg_{uuid.uuid4().hex[:8]}"
    new_msg = {
        "id": msg_id,
        "sender_id": viewer.id,
        "sender_name": viewer.first_name,
        "text": clean_text,
        "timestamp": curr.isoformat(),
    }
    msgs = grp.messages
    msgs.append(new_msg)
    grp.messages = msgs[-50:]
    grp.updated_at = curr

    # If demo members in group, trigger realistic conversational response
    demo_members = [
        m for m in grp.members
        if m.outcome == "active" and m.request_id != viewer.id and getattr(m.request, "is_demo", False)
    ]
    if demo_members and len(msgs) <= 2:
        dm = demo_members[0].request
        reply_msg = {
            "id": f"msg_{uuid.uuid4().hex[:8]}",
            "sender_id": dm.id,
            "sender_name": dm.first_name,
            "text": "Hey! Collecting baggage at Belt 4 now, heading to P3 App Cabs.",
            "timestamp": curr.isoformat(),
        }
        msgs.append(reply_msg)
        grp.messages = msgs

    db.commit()
    return trip_response(db, viewer.session_id)


@app.post("/groups/{id}/no-show")
def report_no_show(id: str, body: NoShowReport, request: Request, db: Session = Depends(get_db)):
    """After depart_time + NO_SHOW_GRACE_MIN the person booking can mark someone as not coming."""
    grp, viewer = viewer_in_group(request, db, id)
    booker_only(grp, viewer)
    grace_cutoff = ensure_utc(grp.depart_time) + timedelta(minutes=CONFIG.NO_SHOW_GRACE_MIN)
    curr_time = ensure_utc(now())
    if curr_time < grace_cutoff:
        mins_remaining = int((grace_cutoff - curr_time).total_seconds() / 60.0)
        raise HTTPException(status_code=400, detail=f"You can mark someone as not coming after {mins_remaining} more minutes.")
    target_mem = db.query(GroupMember).filter(
        GroupMember.group_id == grp.id,
        GroupMember.request_id == body.target_request_id
    ).first()
    if not target_mem:
        raise HTTPException(status_code=404, detail="Target member not found in group.")
    target_mem.outcome = "no_show"
    target_req = db.query(PassengerRequest).filter(PassengerRequest.id == body.target_request_id).first()
    if target_req:
        target_req.status = "cancelled"
        target_req.wipe_private()
        if target_req.session:
            target_req.session.noshow_trips += 1
    remaining = db.query(GroupMember).filter(GroupMember.group_id == grp.id, GroupMember.outcome == "active").all()
    if len(remaining) < 2:
        grp.status = "dissolved"
        for r_mem in remaining:
            r_req = db.query(PassengerRequest).filter(PassengerRequest.id == r_mem.request_id).first()
            if r_req:
                r_req.status = "registered"
                r_req.phase = "waiting"
    else:
        reqs = db.query(PassengerRequest).filter(PassengerRequest.id.in_([m.request_id for m in remaining])).all()
        mg = evaluate_group(reqs[0], reqs, db)
        if mg:
            grp.fare_total_est = mg.fare_total_est
            grp.shared_km = mg.shared_km
            for m in mg.members:
                gm = next((g for g in remaining if g.request_id == m.request_id), None)
                if gm:
                    gm.fare_share_est = m.fare_share_est
    grp.updated_at = now()
    db.commit()
    return {"message": "No-show reported and fares recomputed.", "group_status": grp.status}


@app.post("/groups/{id}/links", response_model=GroupLinkResponse)
def get_group_handoff_links(id: str, request: Request, db: Session = Depends(get_db)):
    """Uber link (first stop), trip text and UPI links. Address lines are only in the booker's copy."""
    grp, viewer = viewer_in_group(request, db, id)
    view = trip_state.group_view(db, grp, viewer)
    lines = [
        f"EcoRide Share, pickup code {view['pickup_code']}",
        f"Pickup: {view['pickup_point']}",
        "Stops:",
    ]
    for i, stop in enumerate(view["stops"]):
        where = stop.get("address_line") or stop["area"]
        lines.append(f"  {i + 1}. {stop['first_name']}: {where}")
    links = view["pay_links"] if view["is_booker"] else ({viewer.id: view["pay_link"]} if view["pay_link"] else {})
    return GroupLinkResponse(
        uber_link=view["uber_link"] or "",
        trip_summary_text="\n".join(lines),
        upi_links={k: v for k, v in links.items() if v},
    )


@app.post("/groups/{id}/cab")
def set_cab_number(id: str, body: CabNumberUpdate, request: Request, db: Session = Depends(get_db)):
    grp, viewer = viewer_in_group(request, db, id)
    booker_only(grp, viewer)
    grp.cab_number = body.cab_number
    grp.updated_at = now()
    if viewer.phase in ("waiting", "landed"):
        viewer.phase = "at_pickup"
    db.commit()
    return trip_response(db, viewer.session_id)


@app.post("/groups/{id}/settle/start")
def start_settle(id: str, request: Request, db: Session = Depends(get_db)):
    grp, viewer = viewer_in_group(request, db, id)
    booker_only(grp, viewer)
    if grp.status == "confirmed":
        grp.status = "settling"
        grp.updated_at = now()
    db.commit()
    return trip_response(db, viewer.session_id)


@app.post("/groups/{id}/settle")
def settle_fare(id: str, body: SettleBody, request: Request, db: Session = Depends(get_db)):
    """The actual fare is split with exactly the same method as the estimate, in whole rupees."""
    grp, viewer = viewer_in_group(request, db, id)
    booker_only(grp, viewer)
    members = db.query(GroupMember).filter(GroupMember.group_id == grp.id, GroupMember.outcome == "active").all()
    reqs = {r.id: r for r in db.query(PassengerRequest).filter(
        PassengerRequest.id.in_([m.request_id for m in members])).all()}
    shares = split_fare_whole_rupees(
        body.final_fare, [(m.request_id, reqs[m.request_id].party_size, m.solo_km) for m in members]
    )
    grp.final_fare = round(body.final_fare)
    grp.final_shares_json = json.dumps(shares)
    grp.booker_upi = body.upi_id
    grp.status = "settling"
    grp.updated_at = now()
    if body.upi_id:
        viewer.upi_id = body.upi_id
    db.commit()
    return trip_response(db, viewer.session_id)


@app.get("/t/{token}")
def get_public_trip_share(token: str, db: Session = Depends(get_db)):
    """Read-only trip view for family (first names and areas only)."""
    grp = db.query(Group).filter(Group.share_token == token).first()
    if not grp:
        raise HTTPException(status_code=404, detail="Trip link not found or expired")
    memberships = db.query(GroupMember).filter(GroupMember.group_id == grp.id).order_by(GroupMember.drop_index).all()
    reqs = {r.id: r for r in db.query(PassengerRequest).filter(
        PassengerRequest.id.in_([m.request_id for m in memberships])).all()}
    booker = reqs.get(grp.booker_request_id)
    term = trip_state.terminal_for(booker)
    return {
        "status": grp.status,
        "airport": "BLR (Kempegowda International Airport)",
        "pickup_point": term.pickup_nickname,
        "pickup_code": grp.pickup_code,
        "cab_type": grp.cab_type,
        "cab_number": grp.cab_number,
        "depart_time": ensure_utc(grp.depart_time).isoformat(),
        "km_saved": grp.km_saved,
        "co2_saved_kg": grp.co2_saved_kg,
        "members": [{
            "first_name": reqs[m.request_id].first_name if m.request_id in reqs else "Traveller",
            "zone": reqs[m.request_id].zone if m.request_id in reqs else "Bengaluru",
            "drop_order": m.drop_index + 1
        } for m in memberships]
    }


# -----------------------------------------------------------------------------
# Join links (invite someone from your flight)
# -----------------------------------------------------------------------------
@app.post("/join-links")
def create_join_link(request: Request, db: Session = Depends(get_db)):
    sess = find_session(request, db)
    p_req = trip_state.active_request(db, sess.session_id) if sess else None
    if not p_req:
        raise HTTPException(status_code=400, detail="Start a trip first.")
    link = JoinLink(
        token=secrets.token_urlsafe(9),
        scheduled_arrival=p_req.scheduled_arrival,
        terminal=p_req.terminal,
        flight_no=p_req.flight_no or None,
        created_at=now(),
    )
    db.add(link)
    db.commit()
    return {"token": link.token, "path": f"/j/{link.token}"}


@app.get("/join/{token}")
def read_join_link(token: str, db: Session = Depends(get_db)):
    link = db.query(JoinLink).filter(JoinLink.token == token).first()
    if not link or ensure_utc(link.created_at) < ensure_utc(now()) - timedelta(hours=CONFIG.PURGE_AFTER_HOURS):
        raise HTTPException(status_code=404, detail="This invite link has expired.")
    return {
        "airport": CONFIG.AIRPORT_CODE,
        "scheduled_arrival": ensure_utc(link.scheduled_arrival).isoformat(),
        "terminal": link.terminal,
        "flight_no": link.flight_no,
    }


# -----------------------------------------------------------------------------
# Impact and admin
# -----------------------------------------------------------------------------
@app.get("/impact", response_model=ImpactMetrics)
def get_impact_metrics(db: Session = Depends(get_db)):
    """Public impact reporting: plain number KPIs and arrival wave breakdown."""
    groups = db.query(Group).filter(Group.status.in_(["confirmed", "settling", "departed", "completed"])).all()
    cabs_avoided = sum(len(g.drop_order) - 1 for g in groups)
    km_saved = round(sum(g.km_saved for g in groups), 1)
    co2_saved_kg = round(km_saved * CONFIG.CO2_KG_PER_KM, 1)

    all_members = db.query(GroupMember).all()
    avg_wait = round(sum(m.extra_wait_min for m in all_members) / max(1, len(all_members)), 1)
    savings = [
        (m.solo_fare_est - m.fare_share_est) / m.solo_fare_est * 100.0
        for m in all_members if m.solo_fare_est
    ]
    avg_save_pct = round(sum(savings) / len(savings), 1) if savings else 0.0

    active_pool_count = db.query(PassengerRequest).filter(PassengerRequest.status.in_(ACTIVE_POOL)).count()
    total_matched = len(all_members)
    match_rate = round((total_matched / max(1, total_matched + active_pool_count)) * 100.0, 1)

    zone_demand: Dict[str, int] = {}
    for r in db.query(PassengerRequest).all():
        zone_demand[r.zone] = zone_demand.get(r.zone, 0) + 1

    # Illustrative arrival-wave baseline for the chart, plus whatever was matched today
    wave_breakdown = [
        {"wave": "10:00 - 10:15", "cabs_avoided": 3, "km_saved": 84.2, "co2_kg": 14.3},
        {"wave": "10:15 - 10:30", "cabs_avoided": 5, "km_saved": 142.0, "co2_kg": 24.1},
        {"wave": "10:30 - 10:45", "cabs_avoided": 4, "km_saved": 110.5, "co2_kg": 18.8},
        {"wave": "10:45 - 11:00", "cabs_avoided": 2, "km_saved": 56.4, "co2_kg": 9.6},
    ]
    baseline = {"cabs": 14, "km": 393.1, "co2": 66.8, "trips": 28}
    return ImpactMetrics(
        cabs_avoided=baseline["cabs"] + cabs_avoided,
        km_saved=round(baseline["km"] + km_saved, 1),
        co2_saved_kg=round(baseline["co2"] + co2_saved_kg, 1),
        trees_equivalent=round((baseline["co2"] + co2_saved_kg) / CONFIG.TREE_KG_PER_YEAR, 1),
        total_trips_matched=baseline["trips"] + total_matched,
        active_pool_count=active_pool_count,
        avg_wait_min=avg_wait or 14.2,
        avg_saving_pct=avg_save_pct or 28.5,
        match_rate_pct=match_rate or 76.4,
        wave_breakdown=wave_breakdown,
        zone_demand=zone_demand,
        assumptions_note="Demo data. Emissions at 0.17 kg CO2 per km (petrol/diesel cab average); a mature tree absorbs about 21 kg a year."
    )


@app.get("/admin/analytics")
def get_admin_analytics(
    password: Optional[str] = Query(None),
    x_admin_pass: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    provided_pass = password or x_admin_pass
    if provided_pass != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid admin password.")
    total_requests = db.query(PassengerRequest).count()
    total_groups = db.query(Group).count()
    confirmed_groups = db.query(Group).filter(Group.status.in_(["confirmed", "settling", "completed"])).count()
    active_pool = db.query(PassengerRequest).filter(PassengerRequest.status.in_(ACTIVE_POOL)).count()
    zones: Dict[str, int] = {}
    for r in db.query(PassengerRequest).all():
        zones[r.zone] = zones.get(r.zone, 0) + 1
    return {
        "clock_utc": now().isoformat(),
        "offset_minutes": CLOCK.get_offset_minutes(),
        "total_requests": total_requests,
        "active_pool": active_pool,
        "total_groups": total_groups,
        "confirmed_groups": confirmed_groups,
        "demand_by_zone": zones,
        "match_rate_pct": round((confirmed_groups * 2.8 / max(1, total_requests)) * 100.0, 1),
        "demo_mode": True
    }


# -----------------------------------------------------------------------------
# Geocoding proxy. The browser never sees a third-party URL.
# -----------------------------------------------------------------------------
@app.get("/geo/search")
def geo_search(q: str = Query(..., min_length=3, max_length=120)):
    """Type-ahead (Photon). Results cached 24h; one upstream request per second across all users."""
    return geo.search(q)


@app.get("/geo/lookup")
def geo_lookup(q: str = Query(..., min_length=3, max_length=200)):
    """Enter / submit only (Nominatim, identifying User-Agent, cached)."""
    return geo.lookup(q)


@app.get("/geo/reverse")
def geo_reverse(lat: float = Query(..., ge=-90, le=90), lng: float = Query(..., ge=-180, le=180)):
    return geo.reverse(lat, lng)


@app.post("/geo/link")
def geo_link(body: MapsLinkBody):
    """Coordinates from a pasted Google Maps link (short links resolved on the server only)."""
    try:
        lat, lng = geo.resolve_maps_link(body.url)
    except geo.MapsLinkError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return geo.reverse(lat, lng)


_TILE_CACHE = geo.TTLCache(7 * 86400, max_items=4000)
# 1x1 transparent PNG: the dark map background shows through when tiles are unavailable
_EMPTY_TILE = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
    "1f15c4890000000d49444154789c6360000002000005000165a6d7a10000000049454e44ae426082"
)


@app.get("/tiles/{z}/{x}/{y}.png")
def map_tile(z: int, x: int, y: int):
    if not (0 <= z <= 19 and 0 <= x < 2 ** z and 0 <= y < 2 ** z):
        raise HTTPException(status_code=404, detail="No such tile")
    key = (z, x, y)
    body = _TILE_CACHE.get(key)
    if body is None:
        body = _EMPTY_TILE
        if not offline_mode():
            try:
                import httpx
                with httpx.Client(timeout=4.0) as client:
                    resp = client.get(CONFIG.TILE_URL.format(z=z, x=x, y=y), headers={"User-Agent": geo.user_agent()})
                if resp.status_code == 200 and resp.headers.get("content-type", "").startswith("image/"):
                    body = resp.content
                    _TILE_CACHE.set(key, body)
            except Exception:
                pass
    return Response(content=body, media_type="image/png", headers={"Cache-Control": "public, max-age=86400"})


# -----------------------------------------------------------------------------
# Demo controls
# -----------------------------------------------------------------------------
@app.post("/demo/seed")
def demo_seed(db: Session = Depends(get_db)):
    seeded = seed_demo_passengers(db, now())
    return {"message": f"Seeded {len(seeded)} demo passengers.", "count": len(seeded)}


@app.post("/demo/advance")
def demo_advance(minutes: int = Query(10, ge=1, le=240)):
    new_time = CLOCK.advance_minutes(minutes)
    return {
        "message": f"Clock advanced by {minutes} minutes.",
        "clock_utc": new_time.isoformat(),
        "offset_minutes": CLOCK.get_offset_minutes()
    }


@app.post("/demo/advance-to-landing")
def demo_advance_to_landing(request: Request, db: Session = Depends(get_db)):
    """Moves the simulated clock to one minute after the caller's landing time."""
    sess = find_session(request, db)
    p_req = trip_state.active_request(db, sess.session_id) if sess else None
    if not p_req:
        raise HTTPException(status_code=400, detail="Start a trip first.")
    target = ensure_utc(p_req.scheduled_arrival) + timedelta(minutes=p_req.delay_min + 1)
    delta_min = (target - ensure_utc(now())).total_seconds() / 60.0
    if delta_min > 0:
        CLOCK.advance_minutes(delta_min)
    return {"clock_utc": now().isoformat(), "offset_minutes": CLOCK.get_offset_minutes()}


@app.post("/demo/reset")
def demo_reset(scenario: str = Query("full", pattern="^(full|stage)$"), db: Session = Depends(get_db)):
    """Restores the seed: clears every trip, invite and group, resets the clock and reseeds."""
    CLOCK.reset()
    geo.PHOTON_QUEUE.reset()
    geo.NOMINATIM_QUEUE.reset()
    seeded = reset_all(db, now(), scenario)
    return {
        "message": "Clock reset to real time and demo passengers reseeded.",
        "clock_utc": now().isoformat(),
        "count": len(seeded)
    }


@app.post("/demo/respond")
def demo_respond(request: Request, db: Session = Depends(get_db)):
    """Makes every demo traveller in the caller's open invite answer now (used by tests and the director)."""
    sess = find_session(request, db)
    p_req = trip_state.active_request(db, sess.session_id) if sess else None
    if not p_req:
        raise HTTPException(status_code=400, detail="Start a trip first.")
    for prop in db.query(Proposal).filter(
        Proposal.status == "open", Proposal.member_request_ids_json.contains(p_req.id)
    ).all():
        resp = prop.responses
        for rid in prop.member_request_ids:
            r = db.query(PassengerRequest).filter(PassengerRequest.id == rid).first()
            if r and (r.is_demo or r.session_id.startswith("sess_demo_")) and resp.get(rid) == "pending":
                resp[rid] = "accepted"
        prop.responses = resp
        if all(v == "accepted" for v in resp.values()):
            form_group(db, prop)
    db.commit()
    return trip_response(db, sess.session_id)


@app.post("/demo/invite-me")
def demo_invite_me(request: Request, db: Session = Depends(get_db)):
    """A demo traveller invites the caller, so the 'invite received' state can be shown."""
    sess = find_session(request, db)
    p_req = trip_state.active_request(db, sess.session_id) if sess else None
    if not p_req or p_req.status not in ACTIVE_POOL:
        raise HTTPException(status_code=400, detail="Start a trip first.")
    all_reqs = db.query(PassengerRequest).filter(PassengerRequest.status.in_(ACTIVE_POOL)).all()
    res = find_matching_options(p_req, all_reqs, now(), db)
    demo_groups = [g for g in res.all_valid_groups if all(m.is_demo or m.request_id == p_req.id for m in g.members)]
    if not demo_groups:
        raise HTTPException(status_code=404, detail="No demo traveller is heading your way right now.")
    best = sorted(demo_groups, key=lambda g: -g.viewer_saving_inr)[0]
    member_ids = [m.request_id for m in best.members]
    initiator = next(rid for rid in member_ids if rid != p_req.id)
    curr_time = now()
    expires_at = curr_time + timedelta(minutes=CONFIG.DEMO_CONFIRM_WINDOW_MIN)
    for r in db.query(PassengerRequest).filter(PassengerRequest.id.in_(member_ids)).all():
        r.lock_until = expires_at
    db.add(Proposal(
        id=f"prop_{uuid.uuid4().hex[:10]}",
        initiator_request_id=initiator,
        member_request_ids_json=json.dumps(member_ids),
        responses_json=json.dumps({rid: ("pending" if rid == p_req.id else "accepted") for rid in member_ids}),
        status="open",
        expires_at=expires_at,
        created_at=curr_time,
    ))
    db.commit()
    return trip_response(db, sess.session_id)
