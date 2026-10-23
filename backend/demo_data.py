"""
backend/demo_data.py — Seed dataset and generator for EcoRide Share demo mode.
Seeds ~30 realistic BLR passengers across 5 arrival waves in a 70-minute span,
covering all demo requirements (NOW group, SOON pair, LATER higher saving,
unmatched empty state, at-risk delay, women-only pool, SUV boot overflow).
All seeded passengers are explicitly tagged is_demo=True.
"""
from datetime import datetime, timezone, timedelta
from typing import List
from sqlalchemy.orm import Session

from backend.models import PassengerRequest, SessionRecord, Group, GroupMember, Proposal, JoinLink
from backend.clock import now
from backend.config import CONFIG
from backend.distance import haversine_distance_km

# The /demo two-phone stage needs the two phones to match each other, so its seed
# leaves out every demo traveller within this distance of Jayanagar.
STAGE_CLEAR_RADIUS_KM = 12.0


def reset_all(db: Session, base_time: datetime = None, scenario: str = "full") -> List[PassengerRequest]:
    """Deletes every trip, invite, group, join link and session, then reseeds the demo travellers."""
    db.query(GroupMember).delete(synchronize_session=False)
    db.query(Group).delete(synchronize_session=False)
    db.query(Proposal).delete(synchronize_session=False)
    db.query(JoinLink).delete(synchronize_session=False)
    db.query(PassengerRequest).delete(synchronize_session=False)
    db.query(SessionRecord).delete(synchronize_session=False)
    db.commit()
    return seed_demo_passengers(db, base_time, scenario)


def seed_demo_passengers(db: Session, base_time: datetime = None, scenario: str = "full") -> List[PassengerRequest]:
    """
    Clears existing demo requests and seeds ~30 demo passengers
    keyed around base_time (defaults to current clock time).
    """
    if base_time is None:
        base_time = now()

    # Align base_time to nearest 5-minute mark for clean presentation
    minute_rounded = (base_time.minute // 5) * 5
    t0 = base_time.replace(minute=minute_rounded, second=0, microsecond=0)

    # Clean existing demo records
    demo_requests = db.query(PassengerRequest).filter(PassengerRequest.is_demo == True).all()
    demo_req_ids = [r.id for r in demo_requests]

    # Delete memberships, proposals, groups tied to demo
    if demo_req_ids:
        db.query(GroupMember).filter(GroupMember.request_id.in_(demo_req_ids)).delete(synchronize_session=False)
        db.query(Proposal).filter(Proposal.initiator_request_id.in_(demo_req_ids)).delete(synchronize_session=False)
        db.query(PassengerRequest).filter(PassengerRequest.is_demo == True).delete(synchronize_session=False)

    db.commit()

    # Helper to get or create demo session
    def get_or_create_session(sess_id: str, name: str, completed: int = 0, noshow: int = 0) -> SessionRecord:
        s = db.query(SessionRecord).filter(SessionRecord.session_id == sess_id).first()
        if not s:
            s = SessionRecord(
                session_id=sess_id,
                first_name=name,
                completed_trips=completed,
                noshow_trips=noshow,
                created_at=t0 - timedelta(hours=2)
            )
            db.add(s)
            db.flush()
        return s

    seeded = []

    # -------------------------------------------------------------
    # Scenario A: Jayanagar / JP Nagar / BTM trio from one flight (NOW Group)
    # -------------------------------------------------------------
    flight_6e = "6E2134"
    w2_time = t0  # Wave 2
    s1 = get_or_create_session("sess_demo_kavya", "Kavya", completed=4, noshow=0)
    s2 = get_or_create_session("sess_demo_arjun", "Arjun", completed=3, noshow=0)
    s3 = get_or_create_session("sess_demo_rohan", "Rohan", completed=5, noshow=1)

    r_kavya = PassengerRequest(
        id="demo_kavya_01", session_id=s1.session_id, first_name="Kavya",
        flight_no=flight_6e, arriving_from="Delhi (DEL)", flight_kind="domestic",
        scheduled_arrival=w2_time, delay_min=0, terminal="T1",
        dest_lat=12.9308, dest_lng=77.5838, dest_label="4th Block, Jayanagar", zone="Jayanagar",
        party_size=1, checked_bags=0, max_wait_min=30, preferred_app="uber", women_only=False,
        status="registered", is_demo=True, created_at=t0 - timedelta(minutes=40)
    )
    r_arjun = PassengerRequest(
        id="demo_arjun_02", session_id=s2.session_id, first_name="Arjun",
        flight_no=flight_6e, arriving_from="Delhi (DEL)", flight_kind="domestic",
        scheduled_arrival=w2_time, delay_min=0, terminal="T1",
        dest_lat=12.9063, dest_lng=77.5857, dest_label="Phase 2, JP Nagar", zone="JP Nagar",
        party_size=1, checked_bags=1, max_wait_min=30, preferred_app="ola", women_only=False,
        status="registered", is_demo=True, created_at=t0 - timedelta(minutes=45)
    )
    r_rohan = PassengerRequest(
        id="demo_rohan_03", session_id=s3.session_id, first_name="Rohan",
        flight_no=flight_6e, arriving_from="Delhi (DEL)", flight_kind="domestic",
        scheduled_arrival=w2_time, delay_min=0, terminal="T1",
        dest_lat=12.9166, dest_lng=77.6101, dest_label="Stage 2, BTM Layout", zone="BTM",
        party_size=1, checked_bags=0, max_wait_min=30, preferred_app="uber", women_only=False,
        status="registered", is_demo=True, created_at=t0 - timedelta(minutes=50)
    )
    seeded.extend([r_kavya, r_arjun, r_rohan])

    # -------------------------------------------------------------
    # Scenario B: Koramangala & Indiranagar pair across flights (SOON Group)
    # -------------------------------------------------------------
    s_sneha = get_or_create_session("sess_demo_sneha", "Sneha", completed=6, noshow=0)
    s_vikram = get_or_create_session("sess_demo_vikram", "Vikram", completed=2, noshow=0)

    r_sneha = PassengerRequest(
        id="demo_sneha_04", session_id=s_sneha.session_id, first_name="Sneha",
        flight_no="AI506", arriving_from="Mumbai (BOM)", flight_kind="domestic",
        scheduled_arrival=t0, delay_min=0, terminal="T2",
        dest_lat=12.9352, dest_lng=77.6245, dest_label="Block 4, Koramangala", zone="Koramangala",
        party_size=1, checked_bags=0, max_wait_min=30, preferred_app="uber", women_only=False,
        status="registered", is_demo=True, created_at=t0 - timedelta(minutes=30)
    )
    r_vikram = PassengerRequest(
        id="demo_vikram_05", session_id=s_vikram.session_id, first_name="Vikram",
        flight_no="UK812", arriving_from="Hyderabad (HYD)", flight_kind="domestic",
        scheduled_arrival=t0 + timedelta(minutes=15), delay_min=0, terminal="T2",
        dest_lat=12.9784, dest_lng=77.6408, dest_label="100 Feet Road, Indiranagar", zone="Indiranagar",
        party_size=1, checked_bags=1, max_wait_min=30, preferred_app="any", women_only=False,
        status="registered", is_demo=True, created_at=t0 - timedelta(minutes=25)
    )
    seeded.extend([r_sneha, r_vikram])

    # -------------------------------------------------------------
    # Scenario C: Whitefield passenger whose LATER option saves more than NOW
    # -------------------------------------------------------------
    s_aditya = get_or_create_session("sess_demo_aditya", "Aditya", completed=3, noshow=0)
    s_meera = get_or_create_session("sess_demo_meera", "Meera", completed=4, noshow=0)
    s_gaurav = get_or_create_session("sess_demo_gaurav", "Gaurav", completed=1, noshow=0)
    s_preeti = get_or_create_session("sess_demo_preeti", "Preeti", completed=8, noshow=0)

    # Aditya lands at t0 + 15
    r_aditya = PassengerRequest(
        id="demo_aditya_06", session_id=s_aditya.session_id, first_name="Aditya",
        flight_no="QP1301", arriving_from="Goa (GOI)", flight_kind="domestic",
        scheduled_arrival=t0 + timedelta(minutes=15), delay_min=0, terminal="T1",
        dest_lat=12.9698, dest_lng=77.7499, dest_label="ITPL Main Rd, Whitefield", zone="Whitefield",
        party_size=1, checked_bags=0, max_wait_min=60, preferred_app="uber", women_only=False,
        status="registered", is_demo=True, created_at=t0 - timedelta(minutes=20)
    )
    # Meera lands at same time (forms a small 2-person NOW group saving ~25%)
    r_meera = PassengerRequest(
        id="demo_meera_07", session_id=s_meera.session_id, first_name="Meera",
        flight_no="QP1301", arriving_from="Goa (GOI)", flight_kind="domestic",
        scheduled_arrival=t0 + timedelta(minutes=15), delay_min=0, terminal="T1",
        dest_lat=12.9698, dest_lng=77.7499, dest_label="Hope Farm, Whitefield", zone="Whitefield",
        party_size=1, checked_bags=1, max_wait_min=60, preferred_app="uber", women_only=False,
        status="registered", is_demo=True, created_at=t0 - timedelta(minutes=18)
    )
    # Gaurav & Preeti land at t0 + 45 (Wave 4) forming a 4-person pool that saves 48% in LATER tier!
    r_gaurav = PassengerRequest(
        id="demo_gaurav_08", session_id=s_gaurav.session_id, first_name="Gaurav",
        flight_no="6E482", arriving_from="Kolkata (CCU)", flight_kind="domestic",
        scheduled_arrival=t0 + timedelta(minutes=45), delay_min=0, terminal="T1",
        dest_lat=12.9591, dest_lng=77.7009, dest_label="Spice Garden, Marathahalli", zone="Marathahalli",
        party_size=1, checked_bags=1, max_wait_min=60, preferred_app="uber", women_only=False,
        status="registered", is_demo=True, created_at=t0 - timedelta(minutes=10)
    )
    r_preeti = PassengerRequest(
        id="demo_preeti_09", session_id=s_preeti.session_id, first_name="Preeti",
        flight_no="6E482", arriving_from="Kolkata (CCU)", flight_kind="domestic",
        scheduled_arrival=t0 + timedelta(minutes=45), delay_min=0, terminal="T1",
        dest_lat=12.9698, dest_lng=77.7499, dest_label="ECC Road, Whitefield", zone="Whitefield",
        party_size=1, checked_bags=0, max_wait_min=60, preferred_app="uber", women_only=False,
        status="registered", is_demo=True, created_at=t0 - timedelta(minutes=5)
    )
    seeded.extend([r_aditya, r_meera, r_gaurav, r_preeti])

    # -------------------------------------------------------------
    # Scenario D: Electronic City passenger with NO match (Empty State)
    # -------------------------------------------------------------
    s_sanjay = get_or_create_session("sess_demo_sanjay", "Sanjay", completed=0, noshow=0)
    r_sanjay = PassengerRequest(
        id="demo_sanjay_10", session_id=s_sanjay.session_id, first_name="Sanjay",
        flight_no="SG102", arriving_from="Chennai (MAA)", flight_kind="domestic",
        scheduled_arrival=t0 + timedelta(minutes=20), delay_min=0, terminal="T1",
        dest_lat=12.8452, dest_lng=77.6602, dest_label="Phase 1, Electronic City", zone="Electronic City",
        party_size=1, checked_bags=1, max_wait_min=15, preferred_app="uber", women_only=False,
        status="registered", is_demo=True, created_at=t0 - timedelta(minutes=15)
    )
    seeded.append(r_sanjay)

    # -------------------------------------------------------------
    # Scenario E: Delayed passenger breaking group & triggering 'at risk' flow
    # -------------------------------------------------------------
    s_varun = get_or_create_session("sess_demo_varun", "Varun", completed=3, noshow=0)
    r_varun = PassengerRequest(
        id="demo_varun_11", session_id=s_varun.session_id, first_name="Varun",
        flight_no="AI804", arriving_from="Pune (PNQ)", flight_kind="domestic",
        scheduled_arrival=t0, delay_min=0, terminal="T2",
        dest_lat=12.9756, dest_lng=77.6066, dest_label="Brigade Road, MG Road", zone="MG Road",
        party_size=1, checked_bags=0, max_wait_min=15, preferred_app="uber", women_only=False,
        status="registered", is_demo=True, created_at=t0 - timedelta(minutes=12)
    )
    seeded.append(r_varun)

    # -------------------------------------------------------------
    # Scenario F: Women-only pool of three
    # -------------------------------------------------------------
    s_ananya = get_or_create_session("sess_demo_ananya", "Ananya", completed=5, noshow=0)
    s_divya = get_or_create_session("sess_demo_divya", "Divya", completed=4, noshow=0)
    s_tanya = get_or_create_session("sess_demo_tanya", "Tanya", completed=7, noshow=0)

    r_ananya = PassengerRequest(
        id="demo_ananya_12", session_id=s_ananya.session_id, first_name="Ananya",
        flight_no="6E512", arriving_from="Kochi (COK)", flight_kind="domestic",
        scheduled_arrival=t0, delay_min=0, terminal="T1",
        dest_lat=12.9784, dest_lng=77.6408, dest_label="Defense Colony, Indiranagar", zone="Indiranagar",
        party_size=1, checked_bags=0, max_wait_min=30, preferred_app="uber", women_only=True,
        status="registered", is_demo=True, created_at=t0 - timedelta(minutes=35)
    )
    r_divya = PassengerRequest(
        id="demo_divya_13", session_id=s_divya.session_id, first_name="Divya",
        flight_no="6E512", arriving_from="Kochi (COK)", flight_kind="domestic",
        scheduled_arrival=t0, delay_min=0, terminal="T1",
        dest_lat=12.9352, dest_lng=77.6245, dest_label="Koramangala 5th Block", zone="Koramangala",
        party_size=1, checked_bags=1, max_wait_min=30, preferred_app="uber", women_only=True,
        status="registered", is_demo=True, created_at=t0 - timedelta(minutes=30)
    )
    r_tanya = PassengerRequest(
        id="demo_tanya_14", session_id=s_tanya.session_id, first_name="Tanya",
        flight_no="AI506", arriving_from="Mumbai (BOM)", flight_kind="domestic",
        scheduled_arrival=t0 + timedelta(minutes=10), delay_min=0, terminal="T1",
        dest_lat=12.9756, dest_lng=77.6066, dest_label="Lavelle Road, MG Road", zone="MG Road",
        party_size=1, checked_bags=0, max_wait_min=30, preferred_app="uber", women_only=True,
        status="registered", is_demo=True, created_at=t0 - timedelta(minutes=20)
    )
    seeded.extend([r_ananya, r_divya, r_tanya])

    # -------------------------------------------------------------
    # Scenario G: Party of 3 with checked bags forcing a larger cab (SUV)
    # -------------------------------------------------------------
    s_rajesh = get_or_create_session("sess_demo_rajesh", "Rajesh", completed=3, noshow=0)
    s_karan = get_or_create_session("sess_demo_karan", "Karan", completed=4, noshow=0)

    # Rajesh has party_size=3, checked_bags=3
    r_rajesh = PassengerRequest(
        id="demo_rajesh_15", session_id=s_rajesh.session_id, first_name="Rajesh",
        flight_no="BA119", arriving_from="London Heathrow (LHR)", flight_kind="international",
        scheduled_arrival=t0 - timedelta(minutes=15), delay_min=0, terminal="T2",
        dest_lat=13.0031, dest_lng=77.5703, dest_label="Margosa Road, Malleshwaram", zone="Malleshwaram",
        party_size=3, checked_bags=3, max_wait_min=30, preferred_app="uber", women_only=False,
        status="registered", is_demo=True, created_at=t0 - timedelta(minutes=45)
    )
    # Karan has party_size=1, checked_bags=1 -> Total 4 seats, 4 bags (sedan boot max is 3) -> forces SUV!
    r_karan = PassengerRequest(
        id="demo_karan_16", session_id=s_karan.session_id, first_name="Karan",
        flight_no="UK812", arriving_from="Hyderabad (HYD)", flight_kind="domestic",
        scheduled_arrival=t0 + timedelta(minutes=15), delay_min=0, terminal="T2",
        dest_lat=12.9982, dest_lng=77.5530, dest_label="Dr Rajkumar Rd, Rajajinagar", zone="Rajajinagar",
        party_size=1, checked_bags=1, max_wait_min=30, preferred_app="uber", women_only=False,
        status="registered", is_demo=True, created_at=t0 - timedelta(minutes=25)
    )
    seeded.extend([r_rajesh, r_karan])

    # -------------------------------------------------------------
    # Additional 14 passengers across Bengaluru zones and 5 arrival waves
    # (Wave 1: -15m, Wave 2: 0m, Wave 3: +15m, Wave 4: +35m, Wave 5: +55m)
    # -------------------------------------------------------------
    additional_specs = [
        # Wave 1 (-15 min)
        ("Naveen", "6E301", "Ahmedabad", "domestic", t0 - timedelta(minutes=15), 13.0358, 77.5970, "Hebbal", "Hebbal Lake", 1, 0, 30, False),
        ("Lakshmi", "6E301", "Ahmedabad", "domestic", t0 - timedelta(minutes=15), 13.1007, 77.5963, "Yelahanka", "Yelahanka New Town", 1, 1, 30, False),
        ("Farhan", "AI102", "Dubai (DXB)", "international", t0 - timedelta(minutes=15), 12.9422, 77.5755, "Basavanagudi", "Gandhi Bazaar", 1, 2, 60, False),

        # Wave 2 (t0)
        ("Deepa", "IX441", "Singapore (SIN)", "international", t0, 12.9121, 77.6446, "HSR", "Sector 1, HSR Layout", 1, 1, 30, False),
        ("Manoj", "6E721", "Jaipur", "domestic", t0, 12.9255, 77.5468, "Banashankari", "BSK 2nd Stage", 1, 0, 30, False),
        ("Shreya", "6E721", "Jaipur", "domestic", t0, 12.9308, 77.5838, "Jayanagar", "Jayanagar 9th Block", 1, 1, 30, False),

        # Wave 3 (+15 min)
        ("Aravind", "QP110", "Mumbai", "domestic", t0 + timedelta(minutes=15), 12.9121, 77.6446, "HSR", "Sector 3, HSR Layout", 1, 0, 30, False),
        ("Ritu", "QP110", "Mumbai", "domestic", t0 + timedelta(minutes=15), 12.9352, 77.6245, "Koramangala", "Koramangala 6th Block", 1, 1, 30, False),
        ("Suresh", "AI404", "Delhi", "domestic", t0 + timedelta(minutes=15), 12.9166, 77.6101, "BTM", "BTM 1st Stage", 1, 0, 30, False),

        # Wave 4 (+35 min)
        ("Pavan", "6E911", "Pune", "domestic", t0 + timedelta(minutes=35), 13.0031, 77.5703, "Malleshwaram", "Sampige Road", 1, 1, 30, False),
        ("Geetha", "6E911", "Pune", "domestic", t0 + timedelta(minutes=35), 12.9982, 77.5530, "Rajajinagar", "Rajajinagar 1st Block", 1, 0, 30, False),
        ("Harish", "UK950", "Delhi", "domestic", t0 + timedelta(minutes=35), 12.9063, 77.5857, "JP Nagar", "JP Nagar 6th Phase", 1, 0, 30, False),

        # Wave 5 (+55 min)
        ("Vinay", "6E882", "Lucknow", "domestic", t0 + timedelta(minutes=55), 12.9784, 77.6408, "Indiranagar", "CMH Road", 1, 0, 30, False),
        ("Swathi", "6E882", "Lucknow", "domestic", t0 + timedelta(minutes=55), 12.9756, 77.6066, "MG Road", "Residency Road", 1, 1, 30, False),
    ]

    for idx, (name, fno, from_city, kind, arr, lat, lng, zone, label, ps, bags, maxw, wo) in enumerate(additional_specs):
        sess = get_or_create_session(f"sess_demo_extra_{idx}", name, completed=3, noshow=0)
        req = PassengerRequest(
            id=f"demo_extra_{idx:02d}", session_id=sess.session_id, first_name=name,
            flight_no=fno, arriving_from=from_city, flight_kind=kind,
            scheduled_arrival=arr, delay_min=0, terminal="T1" if idx % 2 == 0 else "T2",
            dest_lat=lat, dest_lng=lng, dest_label=label, zone=zone,
            party_size=ps, checked_bags=bags, max_wait_min=maxw, preferred_app="uber", women_only=wo,
            status="registered", is_demo=True, created_at=t0 - timedelta(minutes=15)
        )
        seeded.append(req)

    if scenario == "stage":
        jayanagar = CONFIG.ZONES["Jayanagar"]
        seeded = [
            r for r in seeded
            if haversine_distance_km(jayanagar.lat, jayanagar.lng, r.dest_lat, r.dest_lng) > STAGE_CLEAR_RADIUS_KM
        ]

    for r in seeded:
        r.accuracy = "area"
        r.name_given = True
        db.add(r)

    db.commit()
    return seeded
