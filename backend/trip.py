"""
backend/trip.py — Server-derived trip state for the single Trip screen.

The client never decides which state it is in: it renders whatever /trip returns,
so a refresh always resumes the right state. Everything about other travellers is
redacted here (first name, area, approximate distance) before it leaves the server.
"""
import hashlib
from datetime import timedelta
from typing import Any, Dict, List, Optional
from urllib.parse import quote

from sqlalchemy.orm import Session

from backend.config import CONFIG
from backend.clock import now, ensure_utc
from backend.distance import haversine_distance_km
from backend.models import PassengerRequest, Proposal, Group, GroupMember
from backend.matching import (
    find_matching_options, evaluate_group, generate_uber_link,
    redact_group_for_viewer, approx_km, split_fare_whole_rupees,
)

ACTIVE_POOL = ("registered", "landed", "ready_at_pickup")
ACTIVE_ANY = ACTIVE_POOL + ("in_group",)


def iso(dt) -> Optional[str]:
    return ensure_utc(dt).isoformat() if dt is not None else None


def terminal_for(req: Optional[PassengerRequest]):
    key = req.terminal if req else "T1"
    return CONFIG.TERMINALS.get(key, list(CONFIG.TERMINALS.values())[0])


def active_request(db: Session, session_id: Optional[str]) -> Optional[PassengerRequest]:
    if not session_id:
        return None
    return db.query(PassengerRequest).filter(
        PassengerRequest.session_id == session_id,
        PassengerRequest.status.in_(ACTIVE_ANY),
    ).order_by(PassengerRequest.created_at.desc()).first()


def active_membership(db: Session, req: PassengerRequest) -> Optional[GroupMember]:
    """The group this trip belongs to, including one that just finished (so the Done state shows)."""
    return db.query(GroupMember).filter(
        GroupMember.request_id == req.id,
        GroupMember.outcome.in_(["active", "completed"]),
    ).first()


def own_request_view(req: PassengerRequest, group_id: Optional[str] = None) -> Dict[str, Any]:
    """The owner sees everything they entered, including their own private address fields."""
    return {
        "id": req.id,
        "first_name": req.first_name,
        "name_given": bool(req.name_given),
        "flight_no": req.flight_no or None,
        "arriving_from": req.arriving_from or None,
        "flight_kind": req.flight_kind,
        "scheduled_arrival": iso(req.scheduled_arrival),
        "delay_min": req.delay_min,
        "terminal": req.terminal,
        "dest_lat": req.dest_lat,
        "dest_lng": req.dest_lng,
        "dest_label": req.dest_label,
        "zone": req.zone,
        "area": req.zone,
        "accuracy": req.accuracy,
        "exact_address": req.exact_address,
        "drop_detail": req.drop_detail,
        "party_size": req.party_size,
        "checked_bags": req.checked_bags,
        "max_wait_min": req.max_wait_min,
        "preferred_app": req.preferred_app,
        "women_only": req.women_only,
        "status": req.status,
        "phase": req.phase,
        "ready_time": iso(req.ready_time),
        "exit_buffer_min": req.exit_buffer_min(),
        "group_id": group_id,
        "upi_id": req.upi_id,
    }


def option_id(member_ids: List[str]) -> str:
    return "opt_" + hashlib.sha1(",".join(sorted(member_ids)).encode()).hexdigest()[:10]


def pick_best(options: List[Dict[str, Any]], max_wait: int) -> Optional[Dict[str, Any]]:
    """Same rule as the client: highest saving within min(max wait, 30 min); otherwise best overall."""
    if not options:
        return None
    threshold = min(max_wait or 30, 30)
    eligible = [o for o in options if o["viewer_extra_wait_min"] <= threshold]
    pool = eligible or options
    return sorted(pool, key=lambda o: (-o["viewer_saving_inr"], o["viewer_extra_wait_min"]))[0]


def options_view(db: Session, req: PassengerRequest) -> Dict[str, Any]:
    all_reqs = db.query(PassengerRequest).filter(PassengerRequest.status.in_(ACTIVE_POOL)).all()
    res = find_matching_options(req, all_reqs, now(), db)
    groups = []
    for g in res.all_valid_groups:
        d = redact_group_for_viewer(g.model_dump(mode="json"), req)
        d["id"] = option_id([m["request_id"] for m in d["members"]])
        groups.append(d)
    groups.sort(key=lambda o: (-o["viewer_saving_inr"], o["viewer_extra_wait_min"]))
    best = pick_best(groups, req.max_wait_min)
    kept = groups[:10]
    if best and best["id"] not in {o["id"] for o in kept}:
        kept.append(best)
    solo = res.solo_baseline.model_dump(mode="json")
    return {
        "best_id": best["id"] if best else None,
        "needs_longer_wait": bool(best and best["viewer_extra_wait_min"] > min(req.max_wait_min or 30, 30)),
        "groups": kept,
        "solo": solo,
    }


def live_counts(db: Session, req: Optional[PassengerRequest]) -> Dict[str, int]:
    curr = ensure_utc(now())
    others = db.query(PassengerRequest).filter(PassengerRequest.status.in_(ACTIVE_POOL)).all()
    landing = [
        r for r in others
        if (req is None or r.id != req.id)
        and curr - timedelta(minutes=30) <= ensure_utc(r.scheduled_arrival) <= curr + timedelta(minutes=90)
    ]
    heading = 0
    if req is not None:
        heading = sum(
            1 for r in landing
            if r.women_only == req.women_only
            and haversine_distance_km(req.dest_lat, req.dest_lng, r.dest_lat, r.dest_lng) <= CONFIG.PREFILTER_RADIUS_KM
        )
    return {"landing_soon": len(landing), "heading_your_way": heading}


def proposal_members_view(db: Session, prop: Proposal, viewer: PassengerRequest) -> List[Dict[str, Any]]:
    reqs = {r.id: r for r in db.query(PassengerRequest).filter(PassengerRequest.id.in_(prop.member_request_ids)).all()}
    out = []
    for rid in prop.member_request_ids:
        r = reqs.get(rid)
        if not r:
            continue
        out.append({
            "request_id": rid,
            "first_name": r.first_name,
            "area": r.zone,
            "approx_km_from_you": 0.0 if rid == viewer.id else approx_km(viewer.dest_lat, viewer.dest_lng, r.dest_lat, r.dest_lng),
            "response": prop.responses.get(rid, "pending"),
            "is_initiator": rid == prop.initiator_request_id,
            "is_you": rid == viewer.id,
            "is_demo": bool(r.is_demo),
        })
    return out


def why_line(db: Session, prop: Proposal, viewer: PassengerRequest) -> str:
    reqs = db.query(PassengerRequest).filter(PassengerRequest.id.in_(prop.member_request_ids)).all()
    others = [r for r in reqs if r.id != viewer.id]
    if not others:
        return ""
    same_area = any(r.zone == viewer.zone for r in others)
    furthest = max(approx_km(viewer.dest_lat, viewer.dest_lng, r.dest_lat, r.dest_lng) for r in others)
    place = f"Same area ({viewer.zone})" if same_area else f"Drops within about {furthest:g} km of yours"
    gap = max(
        abs((ensure_utc(r.scheduled_arrival) - ensure_utc(viewer.scheduled_arrival)).total_seconds()) / 60.0
        for r in others
    )
    gap_min = max(5, int(round(gap / 5.0)) * 5) if gap >= 2.5 else 0
    when = "lands at the same time as you" if gap_min == 0 else f"lands within {gap_min} minutes of you"
    return f"{place}, {when}."


def proposal_view(db: Session, prop: Proposal, viewer: PassengerRequest) -> Dict[str, Any]:
    curr = ensure_utc(now())
    left = max(0, int((ensure_utc(prop.expires_at) - curr).total_seconds()))
    total = max(1, int((ensure_utc(prop.expires_at) - ensure_utc(prop.created_at)).total_seconds()))
    view: Dict[str, Any] = {
        "id": prop.id,
        "status": prop.status,
        "time_left_seconds": left,
        "window_seconds": total,
        "expires_at": iso(prop.expires_at),
        "members": proposal_members_view(db, prop, viewer),
        "why": why_line(db, prop, viewer),
        "my_response": prop.responses.get(viewer.id, "pending"),
        "i_started": prop.initiator_request_id == viewer.id,
    }
    reqs = db.query(PassengerRequest).filter(PassengerRequest.id.in_(prop.member_request_ids)).all()
    mg = evaluate_group(viewer, reqs, db) if len(reqs) >= 2 else None
    if mg:
        view["saving_inr"] = mg.viewer_saving_inr
        view["share_est"] = mg.viewer_share_est
        view["solo_est"] = mg.viewer_solo_est
        view["extra_wait_min"] = mg.viewer_extra_wait_min
        view["depart_time"] = iso(mg.depart_time)
        view["preview"] = redact_group_for_viewer(mg.model_dump(mode="json"), viewer)
    return view


def address_line(r: PassengerRequest) -> str:
    base = r.exact_address or (r.dest_label if r.dest_label and r.dest_label != r.zone else None) or f"{r.zone} (area)"
    return f"{base} — {r.drop_detail}" if r.drop_detail else base


def group_view(db: Session, grp: Group, viewer: PassengerRequest) -> Dict[str, Any]:
    memberships = db.query(GroupMember).filter(
        GroupMember.group_id == grp.id
    ).order_by(GroupMember.drop_index).all()
    reqs = {r.id: r for r in db.query(PassengerRequest).filter(
        PassengerRequest.id.in_([m.request_id for m in memberships])
    ).all()}
    is_booker = grp.booker_request_id == viewer.id
    confirmed = grp.status in ("confirmed", "settling", "completed")
    shares = grp.final_shares
    booker_req = reqs.get(grp.booker_request_id)
    term = terminal_for(booker_req)

    members = []
    for m in memberships:
        r = reqs.get(m.request_id)
        if not r:
            continue
        is_you = r.id == viewer.id
        members.append({
            "request_id": r.id,
            "first_name": r.first_name,
            "area": r.zone,
            "approx_km_from_you": 0.0 if is_you else approx_km(viewer.dest_lat, viewer.dest_lng, r.dest_lat, r.dest_lng),
            "map_lat": r.dest_lat if is_you else round(r.dest_lat, 2),
            "map_lng": r.dest_lng if is_you else round(r.dest_lng, 2),
            "drop_index": m.drop_index,
            "fare_share_est": m.fare_share_est,
            "solo_fare_est": m.solo_fare_est,
            "final_share": shares.get(r.id),
            "extra_wait_min": m.extra_wait_min,
            "outcome": m.outcome,
            "phase": r.phase,
            "is_booker": r.id == grp.booker_request_id,
            "is_you": is_you,
            "is_demo": bool(r.is_demo),
        })
    active = [m for m in members if m["outcome"] in ("active", "completed")]

    # Ordered stops. Address lines go only to the person booking, only once the group is confirmed.
    stops = []
    for m in sorted(active, key=lambda x: x["drop_index"]):
        r = reqs[m["request_id"]]
        stop = {"drop_index": m["drop_index"], "first_name": m["first_name"], "area": m["area"], "is_you": m["is_you"]}
        if is_booker and confirmed:
            stop["address_line"] = address_line(r)
        stops.append(stop)

    view: Dict[str, Any] = {
        "id": grp.id,
        "status": grp.status,
        "cab_type": grp.cab_type,
        "cab_name": CONFIG.CAB_TYPES[grp.cab_type].name if grp.cab_type in CONFIG.CAB_TYPES else grp.cab_type,
        "pickup_code": grp.pickup_code,
        "pickup_point": term.pickup_nickname,
        "pickup_coords": {"lat": term.lat, "lng": term.lng},
        "share_token": grp.share_token,
        "depart_time": iso(grp.depart_time),
        "shared_km": grp.shared_km,
        "solo_km_sum": grp.solo_km_sum,
        "km_saved": grp.km_saved,
        "co2_saved_kg": grp.co2_saved_kg,
        "fare_total_est": grp.fare_total_est,
        "at_risk": grp.at_risk,
        "at_risk_reason": grp.at_risk_reason,
        "cab_number": grp.cab_number,
        "final_fare": grp.final_fare,
        "booker_upi": grp.booker_upi if grp.final_fare else None,
        "is_booker": is_booker,
        "booker_name": booker_req.first_name if booker_req else "",
        "members": active,
        "stops": stops,
        "uber_link": None,
        "pay_link": None,
        "pay_links": {},
        "messages": [
            {
                "id": m.get("id"),
                "sender_name": m.get("sender_name", "Traveler"),
                "text": m.get("text", ""),
                "timestamp": m.get("timestamp"),
                "is_you": m.get("sender_id") == viewer.id,
            }
            for m in (getattr(grp, "messages", []) or [])
        ],
    }

    if is_booker and confirmed and grp.drop_order:
        first = reqs.get(grp.drop_order[0])
        if first:
            # The first stop's area is used as the nickname: no private text ever goes into a URL.
            view["uber_link"] = generate_uber_link(
                term.lat, term.lng, term.pickup_nickname,
                first.dest_lat, first.dest_lng, f"{first.zone}, Bengaluru",
            )

    if grp.final_fare and booker_req:
        for m in active:
            if m["is_booker"] or m["final_share"] is None:
                continue
            link = None
            if grp.booker_upi:
                link = (
                    f"upi://pay?pa={quote(grp.booker_upi, safe='@.')}&pn={quote(booker_req.first_name)}"
                    f"&am={m['final_share']}&cu=INR&tn={quote('EcoRide cab share')}"
                )
            if is_booker:
                view["pay_links"][m["request_id"]] = link
            elif m["is_you"]:
                view["pay_link"] = link
    return view


def group_state(grp: Group, viewer: PassengerRequest) -> str:
    is_booker = grp.booker_request_id == viewer.id
    if viewer.phase == "done" or (not is_booker and viewer.phase == "paid"):
        return "done"
    if grp.status == "completed" and is_booker:
        return "done"
    if grp.status in ("settling", "completed") or grp.final_fare is not None:
        return "settle"
    if grp.cab_number:
        return "cab_booked"
    if viewer.phase == "at_pickup":
        return "at_pickup"
    if viewer.phase == "landed":
        return "landed"
    return "confirmed"


def recent_notice(db: Session, req: PassengerRequest) -> Optional[str]:
    """One plain sentence when an invite just ended without a group."""
    curr = ensure_utc(now())
    props = db.query(Proposal).filter(
        Proposal.member_request_ids_json.contains(req.id),
        Proposal.status.in_(["declined", "expired", "cancelled"]),
    ).order_by(Proposal.created_at.desc()).limit(1).all()
    if not props:
        return None
    p = props[0]
    if (curr - ensure_utc(p.expires_at)).total_seconds() > 60 and (curr - ensure_utc(p.created_at)).total_seconds() > 90:
        return None
    if p.status == "declined":
        decliner = next((rid for rid, v in p.responses.items() if v == "declined" and rid != req.id), None)
        if decliner:
            r = db.query(PassengerRequest).filter(PassengerRequest.id == decliner).first()
            return f"{r.first_name if r else 'Someone'} said no thanks. Here are your other options."
        return None
    if p.status == "expired":
        return "Not everyone replied in time. Here are your other options."
    return None


def build_trip(db: Session, session_id: Optional[str]) -> Dict[str, Any]:
    curr = ensure_utc(now())
    req = active_request(db, session_id)
    base: Dict[str, Any] = {
        "server_time": curr.isoformat(),
        "state": "start",
        "request": None,
        "options": None,
        "proposal": None,
        "invite": None,
        "group": None,
        "notice": None,
        "underlying_state": "start",
        "live": live_counts(db, None),
    }
    if req is None:
        return base

    membership = active_membership(db, req) if req.status == "in_group" else None
    grp = db.query(Group).filter(Group.id == membership.group_id).first() if membership else None
    base["request"] = own_request_view(req, grp.id if grp else None)
    base["live"] = live_counts(db, req)

    # An incoming invite slides over any pre-group state.
    raw_props = db.query(Proposal).filter(
        Proposal.status == "open",
        Proposal.member_request_ids_json.contains(req.id),
    ).order_by(Proposal.created_at.desc()).all()
    open_props = []
    expired_any = False
    for p in raw_props:
        if curr > ensure_utc(p.expires_at):
            p.status = "expired"
            for r in db.query(PassengerRequest).filter(PassengerRequest.id.in_(p.member_request_ids)).all():
                if r.status != "in_group":
                    r.lock_until = None
            expired_any = True
        else:
            open_props.append(p)
    if expired_any:
        db.commit()

    incoming = next((p for p in open_props if p.initiator_request_id != req.id and p.responses.get(req.id) == "pending"), None)
    outgoing = next((p for p in open_props if p.responses.get(req.id) == "accepted"), None)

    if grp is not None and grp.status != "dissolved":
        base["group"] = group_view(db, grp, req)
        base["state"] = base["underlying_state"] = group_state(grp, req)
        return base

    if incoming is not None:
        base["invite"] = proposal_view(db, incoming, req)
    if outgoing is not None:
        base["proposal"] = proposal_view(db, outgoing, req)
        base["state"] = "invite_sent"
    else:
        base["options"] = options_view(db, req)
        base["state"] = "options" if base["options"]["groups"] else "no_match"
        base["notice"] = recent_notice(db, req)
    base["underlying_state"] = base["state"]
    if incoming is not None:
        base["state"] = "invite_received"
    return base
