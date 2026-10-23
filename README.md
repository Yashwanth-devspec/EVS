# EcoRide Share — Kempegowda International Airport (BLR)

> **Platform-only airport cab matching utility.** Travellers landing around the same hour heading towards the same parts of Bengaluru meet at the pickup curb, share a regular cab (Uber, Ola, Rapido, Namma Yatri), and split the fare directly via UPI.

---

## 1. Product Vision & Architecture

* **Zero Commission**: The platform takes 0% cut. It is an open public coordination utility.
* **Account-Free & Ephemeral**: No passwords, email addresses, phone numbers, or credit cards are collected. All trip requests and passes automatically purge after 24 hours.
* **No Fleet Dispatch**: Groups form on the platform. One member books a normal cab in any consumer taxi app using our pre-calculated stop sequence, and co-passengers settle their proportional share.
* **Prior Art & Existing Services**: Acknowledges and honors pioneering services such as **Quick Ride** and **GoPool**, while differentiating through an open, zero-fee, zero-account coordination architecture.

---

## 2. Art Direction: *"Arrival Hall at Night"*

The interface is inspired by Swiss airport wayfinding crossed with an airline boarding pass. It departs radically from generic dark-mode SaaS templates through three consistent physical motifs:

1. **The Physical Ticket**: Physical paper-colored ticket surfaces (`#F3EFE6`) on an ink canvas (`#07090A`) with circular side punch notches and perforation dividers (`Perforation`).
2. **Runway Dashes**: Dashed amber lines function as dividers, loaders, timelines, and progress indicators.
3. **Cockpit Avionics Typography**: All flight numbers, times, landing countdowns, pickup codes, and rupee amounts are set in **B612 Mono** with strict `tabular-nums`. Headings and UI text are set in **Bricolage Grotesque**.

### Color Discipline
* Color sits **only** on data:
  * **Amber** (`#FFB020` / `#8A5A00`): Time, wait horizons, delay shifts.
  * **Green** (`#3DDC97` / `#0B7A4B`): Rupee savings, CO2 avoided, confirmed groups.
  * **Red** (`#FF5C4D`): Flight delays, cancellations, no-show reports.
* Chrome, frames, and background surfaces are neutral `ink-950` to `ink-700`.
* Zero stock photographs or Wikimedia images.
* Static 3% grain texture overlay on ink backgrounds.

---

## 3. Core Screens & Capabilities

1. **Landing (`/`)**: 100svh hero with soft amber radial city glow, 96px display title, signature **Convergence Map** showing mathematical equirectangular projection of BLR airport to 16 drop zones (animating 12 solo cabs into 4 shared corridors), interactive **Fare Split Calculator**, emissions poster, and honest disclosure strip.
2. **Check-In (`/checkin`)**: Single 880px physical paper ticket boarding pass with a live updating tear-off stub. Features custom IST landing time picker (hour/minute steppers and quick chips) defaulting to the upcoming quarter-hour, 25 airport origins, drop zone map, and 180ms physical stamp animation.
3. **Ride Pool (`/pool`)**: Two-column layout:
   * Left: "My Pass" compact ticket with live second-by-second countdown and quick status pills (`I've Landed`, `I'm Delayed`, `At Pickup`), plus the FIDS Arrival Waves Outlook Board.
   * Right: **Wait-vs-Save Timeline** with stepped SVG curve, Now/Soon/Later shaded tier zones, keyboard navigation, and expanded vehicle seat glyph preview (`CabSeats`).
4. **Inbox (`/inbox`)**: Time-locked incoming proposals featuring SVG radial countdown rings and one-tap Accept/Decline actions. Empty state with animated runway dashes.
5. **Group Ride Pass (`/group`)**: Confirmed physical ride pass ticket with giant 160px mono curb code on the stub, ordered drop stops with distance metrics, 1-tap Uber deep-link, and UPI settlement chips.
6. **Emissions Impact (`/impact`)**: Poster layout with giant CO2 avoided hero counter, unboxed supporting metrics, and hand-drawn paired bar chart comparing solo vs pooled dispatches per arrival wave.
7. **Methodology (`/methodology`)**: 12-column editorial whitepaper layout with a sticky Table of Contents, operational assumptions table with sources, mathematical formulas in monospace blocks, and GoPool/Quick Ride credits.
8. **Admin Operations (`/admin`)**: Linear/Vercel-style high-density operational telemetry screen. Features a 16-zone &times; 5-wave heat matrix with green intensity, plain-number KPI counters, and simulation clock controls (+10m, +30m, Reset & Reseed).
9. **Simulation Drawer**: Floating bottom-right "Demo" pill opening a fast-forward time-travel drawer with pre-calibrated scenario boarding passes.

---

## 4. Quickstart & Running Locally

### Prerequisites
- **Node.js**: v18 or higher & `npm`
- **Python**: v3.10 or higher & `python3-venv`
- **Git**

### 1. Clone the repository
```bash
git clone https://github.com/Yashwanth-devspec/EVS.git
cd EVS
```

### 2. Set up the Python virtual environment
```bash
# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install backend dependencies
pip install -r requirements.txt
```

### 3. Install Node.js frontend dependencies
```bash
npm install
```

### 4. Configure environment (optional)
```bash
cp .env.example .env
# Edit .env if you wish to adjust ADMIN_PASSWORD, offline mode, or custom port
```

### 5. Start development servers
Run both the FastAPI backend (`:8000`) and the Vite React frontend (`:5173`) with one command:
```bash
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

> You can also run them independently if desired:
> - Backend: `npm run dev:backend` (FastAPI with reload at `http://127.0.0.1:8000`)
> - Frontend: `npm run dev:frontend` (Vite dev server at `http://localhost:5173`)

---

## 5. Verification & Testing

### Backend Unit Tests (pytest)
```bash
npm run test:backend
# 17 / 17 passed (100% green)
```

### Frontend Unit Tests (Vitest)
```bash
npm run test:frontend
# 12 / 12 passed (100% green)
```

### Production Build
```bash
npm run build
# tsc && vite build -> 0 errors, bundled in under 900ms
```

### Visual Browser QA & Rubric
Full browser walkthrough script in `scripts/capture_qa.mjs` generates 18 high-resolution screenshots in `qa/` across both 1440&times;900 desktop and 390&times;844 mobile viewports. Detailed critique scores and assessments are logged in `qa/REVIEW.md`. Motion analysis and audit findings are documented in `MOTION_NOTES.md`.
