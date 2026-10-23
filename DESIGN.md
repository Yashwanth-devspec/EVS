# DESIGN.md — EcoRide Share Design System & Architecture

> **Concept**: *"Arrival hall at night."* A dark hall with bright tickets. Swiss airport wayfinding crossed with an authentic airline boarding pass. Calm, confident, slightly cinematic. Evokes airport signage, flight information display systems (FIDS), passenger tickets, and city lights seen from descent into Kempegowda International Airport (BLR).

---

## 1. Core Motifs (The Three Pillars)

1. **The Ticket**
   - Key interactive entities (Check-In boarding pass, Wait-vs-Save option cards, Group Ride Pass) are physical paper-toned ticket forms (`#F3EFE6`).
   - Feature genuine semicircular ticket side-notches (built via CSS radial mask or SVG path) and a distinct perforated dashed tear-line before a live stub.
   - Text on paper uses high-contrast `#0E1210` with specialized semantic tints (`#0B7A4B` green-ink for savings, `#8A5A00` amber-ink for wait time).

2. **Runway Dashes**
   - A dashed amber line (`#FFB020`) acts as the universal thematic divider, step progress indicator, status timeline connector, and interactive slider track.
   - Evokes runway centerline markings and airport taxiway navigational lights.

3. **Cockpit Data Type**
   - High-legibility technical monospace (**B612 Mono**) with fixed `font-variant-numeric: tabular-nums` used exclusively for flight numbers (`6E 2134`), timestamps (`6:45 pm`), countdowns (`18:42`), pickup curb codes (`T1-CURB-B`), and currency figures (`Rs 520`).
   - Plain UI copy, headlines, and labels are set in **Bricolage Grotesque**.

---

## 2. Color Palette & Semantic Tokens

Theme: **Dark is the designed theme.** No light mode switch.

| Token | Hex | Role & Usage Rules |
| :--- | :--- | :--- |
| `--ink-950` | `#07090A` | Deep airport night canvas (page ground). |
| `--ink-900` | `#0C0F10` | Raised panels, top navigation bar, drawer ground. |
| `--ink-800` | `#14181A` | Sub-panels, card containers, elevated module stages. |
| `--ink-700` | `#1E2426` | Hairlines, borders, subtle bounding geometry. |
| `--paper` | `#F3EFE6` | Physical boarding ticket ground (warm textured ivory). |
| `--paper-dim` | `#E6E0D2` | Ticket stub background, inactive ticket sections. |
| `--on-paper-ink` | `#0E1210` | High-contrast typography printed onto paper tickets. |
| `--amber` | `#FFB020` | **Data only**: Time, wait minutes, delays, arrival waves, runway dashes. |
| `--green` | `#3DDC97` | **Data only**: Rupees saved, emissions prevented (CO2), confirmed matches. |
| `--red` | `#FF5C4D` | **Data only**: No-shows, flight delay alerts, proposal expiration warnings. |
| `--green-ink` | `#0B7A4B` | Contrast-safe green on ivory paper tickets. |
| `--amber-ink` | `#8A5A00` | Contrast-safe amber on ivory paper tickets. |
| `--text-primary` | `#ECEFEA` | Primary typography on dark ground (AA/AAA contrast). |
| `--text-secondary`| `#A7B0AB` | Secondary captions, subheadings, and metadata on dark ground. |

### Strict Color Restraint Rule
Color **only ever sits on data** (money saved, minutes waited, CO2 prevented, alerts). Navigation frames, borders, and button chrome remain strictly neutral. No multi-colored decorative gradients. Exactly one soft amber radial ambient glow behind the hero at max 12% opacity. Static 3% grain overlay on ink backgrounds.

---

## 3. Typography System

- **UI & Headlines**: `Bricolage Grotesque` (variable). Warm, punchy, human grotesque with British/Swiss airport wayfinding personality.
- **Cockpit Data & Codes**: `B612 Mono` (Google/Airbus open cockpit typeface designed specifically for extreme legibility on avionics displays).

### Typographic Scale
- **Hero Display**: `96px` (leading `0.92`, tracking `-0.025em`) on desktop; `56px` on mobile.
- **Heading 2 (`h2`)**: `44px` (leading `1.05`, tracking `-0.02em`).
- **Heading 3 (`h3`)**: `28px` (leading `1.15`).
- **Body Text**: `17px` (leading `1.5`, tracking `0`).
- **Small / Metadata**: `14px` (leading `1.4`).
- **Cockpit Data**: `14px` to `20px` tabular monospace.
- **Hero Numerals**: Up to `160px` in B612 Mono on the Group Pickup Code stub.

No uppercase micro-labels. No more than two weights per screen (Regular 400 & SemiBold 600/700).

---

## 4. Components & Physical Buttons

1. **Primary Button**
   - **One single primary style**: Cream pill (`#F3EFE6`), crisp dark text (`#07090A`), 52px height, generous 32px horizontal padding, bold arrow glyph (`→`).
   - Active micro-scale `0.97`, subtle hover brighten.
2. **Secondary Actions**
   - High-contrast text link with distinct underline appearing on hover. Never generic gray outlined ghost boxes.
3. **RunwayDash**
   - Amber dashed rules (`stroke-dasharray="6 6"`) connecting multi-step processes and timelines.
4. **Ticket & Stub**
   - Scalloped side notches (`mask-image: radial-gradient(...)`), dashed perforation line with circular punch-outs, tactile hover response.
5. **DigitRoll**
   - Smooth numeric transition (<200ms) that ticks digits cleanly without layout displacement.

---

## 5. Screen Compositions

### 1. Landing Screen (`/`)
- Full 100svh viewport. Asymmetrical 12-column layout.
- Hero: Two-line display headline `"You landed together. Leave together."` with soft ambient city glow.
- **Signature Convergence Map**: Full-bleed mathematical equirectangular projection of BLR airport centroid to the 16 Bengaluru zones.
  - State A ("Today"): 12 separate thin amber trails showing individual taxis leaving BLR.
  - State B ("With EcoRide"): Convergence into 4 collective shared corridors.
  - Interactive scrub / toggle with live counter transitioning from "12 cabs" to "4 cabs".
- How It Works: Runway-dash asymmetric narrative path with mini live diagrams.
- Interactive Fare Splitter: Slider (1–4 riders) computing real per-person savings against BLR-Jayanagar baseline (~Rs 1,500).
- Honest Disclosure & Footer with 24h auto-purge badge.

### 2. Check-In Boarding Pass (`/checkin`)
- Single cohesive ivory ticket (~880px desktop) with live interactive Stub on the right.
- As the user completes Step 1 (Flight details), Step 2 (Drop Zone & Luggage), and Step 3 (Preferences), perforation fills with ink.
- Custom IST quarter-hour landing time picker (defaults to next quarter-hour from current time, preventing past timestamps).
- "Get My Pass" stamps the ticket and smoothly slides into the Pool.

### 3. Ride Pool & Wait-vs-Save Timeline (`/pool`)
- Two-column split:
  - Left (5 cols): "My Pass" compact ticket with real-time countdown (`ready in 18:42`) and quick arrival action pills ("I've Landed", "I'm Delayed", "At Pickup"). Below: Live Airport Arrival Outlook Board (FIDS wave list).
  - Right (7 cols): **Wait-vs-Save Signature Module**. Giant green savings readout (`Save Rs 520 est.`), amber departure schedule, hand-drawn stepped savings curve with Now/Soon/Later shaded zones, interactive draggable node handle with full keyboard arrow controls.
  - Selected node expands into Group Preview with top-down cab seating glyph (filled/empty seats) and detour bar.
  - Empty state: Outlook board + southern corridor outlook + "Keep looking" & "Book solo in Uber" actions.

### 4. Proposal Inbox (`/inbox`)
- Proposal cards rendered as compact boarding slips with circular SVG countdown rings and direct Accept/Decline actions.

### 5. Group Ride Pass (`/group`)
- Confirmed boarding pass featuring a giant `160px` pickup code (`T1-B4`) on the tear-off stub.
- Vertical runway dash timeline with ordered passenger drop points and km distance.
- Direct "Open in Uber" link with deep URL encoding and 1-tap UPI payment chips for instant fare splitting.

### 6. Emissions & Traffic Impact (`/impact`)
- Editorial poster layout. Giant headline figure for CO2 prevented (est.).
- Paired column charts per arrival wave (solo baseline vs shared reduction).
- Trees planted equivalence and "Demo data" disclaimer chip.

### 7. Methodology & Algorithm Transparency (`/methodology`)
- Sticky table-of-contents navigation.
- Labelled parameter table, route permutation math, OSRM road factor calibration, and explicit acknowledgment of prior Indian carpooling services (Quick Ride, GoPool).

### 8. Operations Console (`/admin`)
- Calm, high-density operations view (Linear / Vercel aesthetic).
- Real-time zone demand heat matrix, matching conversion percentages, and demo time-travel controls.

---

## 6. Motion & Interaction Principles (Emil Kowalski Craft)

- **Duration**: Fast, responsive 120ms–220ms transitions. Never exceed 300ms.
- **Easing**: Crisp standard ease-out `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Purpose-Driven**: Motion only demonstrates origin, state changes, or physical transformations.
- **Delight Moments**:
  - The Convergence Map scroll transition.
  - Ticket stamping animation (scale `1.12` to `1.0` with `-6°` rotation in 180ms).
  - The Wait-vs-Save slider snap.
- **Reduced Motion**: Full fallback to instant opacity transitions whenever `prefers-reduced-motion: reduce` is enabled.
