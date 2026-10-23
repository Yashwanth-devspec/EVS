import React from 'react';
import { PublicConfig } from '../types';
import { RunwayDash } from './primitives/RunwayDash';

interface MethodologyViewProps {
  config: PublicConfig | null;
}

export const MethodologyView: React.FC<MethodologyViewProps> = ({ config }) => {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-ink-950 text-primary py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12 max-w-3xl">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-secondary text-sm">
              How we estimate, and what we don’t know
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight font-sans text-primary leading-tight">
            How we estimate
          </h1>
          <p className="mt-4 text-base sm:text-lg text-secondary leading-relaxed">
            Every heuristic, distance model, fare algorithm, airport buffer, and environmental coefficient governing EcoRide Share is disclosed below. All estimates are labelled <span className="font-cockpit text-amber">est.</span>
          </p>
        </div>

        {/* 12-Column Editorial Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left Column: Sticky Table of Contents (3 cols) */}
          <nav
            aria-label="Table of Contents"
            className="lg:col-span-3 lg:sticky lg:top-24 bg-ink-900/60 p-5 rounded-xl border border-ink-800 space-y-3"
          >
            <div className="text-xs font-cockpit text-secondary font-semibold pb-2 border-b border-ink-800">
              Contents
            </div>
            <ul className="space-y-2 text-sm font-cockpit">
              <li>
                <button
                  onClick={() => scrollTo('prior-art')}
                  className="text-left text-secondary hover:text-amber transition-colors w-full"
                >
                  01. Prior Art & Existing Services
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollTo('assumptions')}
                  className="text-left text-secondary hover:text-amber transition-colors w-full"
                >
                  02. Operational Assumptions
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollTo('formulas')}
                  className="text-left text-secondary hover:text-amber transition-colors w-full"
                >
                  03. Mathematical Formulas
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollTo('limits')}
                  className="text-left text-secondary hover:text-amber transition-colors w-full"
                >
                  04. Platform Limits
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollTo('privacy')}
                  className="text-left text-secondary hover:text-amber transition-colors w-full"
                >
                  05. Privacy Architecture
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollTo('what-can-go-wrong')}
                  className="text-left text-secondary hover:text-amber transition-colors w-full"
                >
                  06. What can go wrong
                </button>
              </li>
            </ul>
          </nav>

          {/* Right Column: Editorial Sections (9 cols) */}
          <div className="lg:col-span-9 space-y-16">
            {/* 01. Prior Art */}
            <section id="prior-art" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-2">
                <span className="font-cockpit text-amber text-sm font-bold">01</span>
                <h2 className="text-2xl font-bold font-sans text-primary">
                  Prior Art & Existing Services
                </h2>
              </div>
              <RunwayDash />
              <div className="text-secondary leading-relaxed space-y-3 text-base">
                <p>
                  EcoRide Share is not the first airport ride-pooling initiative in Bengaluru. Commercial services such as <strong className="text-primary font-semibold">Quick Ride</strong> and <strong className="text-primary font-semibold">GoPool</strong> have operated peer-to-peer and taxi ride pooling in India for years, proving commuter demand for shared transit corridors.
                </p>
                <p>
                  EcoRide Share differs structurally by operating as an <strong className="text-primary font-semibold">account-free, open matching coordination utility</strong>:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 rounded-lg bg-ink-900 border border-ink-800">
                    <div className="text-sm text-amber font-semibold">Commercial cab apps</div>
                    <p className="text-xs text-secondary mt-1">
                      Charge 15–25% platform commissions, run proprietary closed dispatch algorithms, require persistent customer accounts, and lock users to their driver fleet.
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-ink-900 border border-green/30">
                    <div className="text-sm text-green font-semibold">EcoRide Share</div>
                    <p className="text-xs text-secondary mt-1">
                      Zero commissions, zero payment processing, zero account creation, and zero fleet dispatch. Travellers form groups, verify at curb, and book in any app (Uber, Ola, Rapido, Namma Yatri).
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* 02. Operational Assumptions */}
            <section id="assumptions" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-2">
                <span className="font-cockpit text-amber text-sm font-bold">02</span>
                <h2 className="text-2xl font-bold font-sans text-primary">
                  Operational Assumptions
                </h2>
              </div>
              <RunwayDash />
              <p className="text-secondary text-sm">
                The matching engine enforces transparent thresholds configured in backend parameters (exposed live via <code className="font-cockpit text-primary bg-ink-900 px-1.5 py-0.5 rounded text-xs">GET /config</code>):
              </p>

              <div className="overflow-x-auto rounded-xl border border-ink-800 bg-ink-900/60">
                <table className="w-full text-left text-sm font-cockpit border-collapse">
                  <thead>
                    <tr className="border-b border-ink-800 bg-ink-900 text-xs text-secondary">
                      <th className="p-3.5 font-semibold">Assumption / Parameter</th>
                      <th className="p-3.5 font-semibold">Value</th>
                      <th className="p-3.5 font-semibold">Source or Basis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-800/60 text-xs">
                    <tr>
                      <td className="p-3.5 font-bold text-primary">AIRPORT_CENTROID</td>
                      <td className="p-3.5 text-amber">13.1986° N, 77.7066° E</td>
                      <td className="p-3.5 text-secondary font-sans">Official BLR Kempegowda Terminal 1/2 reference centroid</td>
                    </tr>
                    <tr>
                      <td className="p-3.5 font-bold text-primary">EXIT_BUFFER_MIN</td>
                      <td className="p-3.5 text-primary">
                        Dom Cabin: 15m · Dom Bag: 30m<br />
                        Intl Cabin: 35m · Intl Bag: 50m
                      </td>
                      <td className="p-3.5 text-secondary font-sans">Empirical baggage carousel & immigration transit buffers (assumption)</td>
                    </tr>
                    <tr>
                      <td className="p-3.5 font-bold text-primary">MAX_DETOUR_RATIO</td>
                      <td className="p-3.5 text-amber">1.30 (30% max extra km)</td>
                      <td className="p-3.5 text-secondary font-sans">Corridor filter to ensure no rider is taken severely out of direction</td>
                    </tr>
                    <tr>
                      <td className="p-3.5 font-bold text-primary">MAX_EXTRA_KM_PER_MEMBER</td>
                      <td className="p-3.5 text-amber">8.0 km</td>
                      <td className="p-3.5 text-secondary font-sans">Upper bound cap on additional route distance for intermediate drops</td>
                    </tr>
                    <tr>
                      <td className="p-3.5 font-bold text-primary">MIN_SAVING_PCT</td>
                      <td className="p-3.5 text-green">10.0% est.</td>
                      <td className="p-3.5 text-secondary font-sans">A match is valid only if every member saves at least 10% vs solo</td>
                    </tr>
                    <tr>
                      <td className="p-3.5 font-bold text-primary">ROAD_FACTOR</td>
                      <td className="p-3.5 text-primary">1.35</td>
                      <td className="p-3.5 text-secondary font-sans">Haversine-to-road multiplier calibrated against Bengaluru highway network</td>
                    </tr>
                    <tr>
                      <td className="p-3.5 font-bold text-primary">FARE_BASE & PER_KM</td>
                      <td className="p-3.5 text-green">Rs 100 base + Rs 26/km</td>
                      <td className="p-3.5 text-secondary font-sans">Calibrated so solo BLR to Jayanagar (47 km) lands near Rs 1,500 est.</td>
                    </tr>
                    <tr>
                      <td className="p-3.5 font-bold text-primary">CO2_KG_PER_KM</td>
                      <td className="p-3.5 text-green">0.17 kg CO2 / km</td>
                      <td className="p-3.5 text-secondary font-sans">Fleet average for commercial petrol/diesel airport sedans (ARAI standard)</td>
                    </tr>
                    <tr>
                      <td className="p-3.5 font-bold text-primary">TREE_KG_PER_YEAR</td>
                      <td className="p-3.5 text-green">21.0 kg CO2 / year</td>
                      <td className="p-3.5 text-secondary font-sans">Standard annual sequestration for mature subtropical urban tree</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* 03. Mathematical Formulas */}
            <section id="formulas" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-2">
                <span className="font-cockpit text-amber text-sm font-bold">03</span>
                <h2 className="text-2xl font-bold font-sans text-primary">
                  Mathematical Formulas
                </h2>
              </div>
              <RunwayDash />
              <p className="text-secondary text-sm">
                All grouping calculations run deterministically with strictly reproducible outcomes:
              </p>

              <div className="space-y-4 font-cockpit text-xs">
                {/* 1. Pickup Ready Time */}
                <div className="p-5 rounded-xl bg-ink-900 border border-ink-800 space-y-2">
                  <div className="flex items-center justify-between text-secondary">
                    <span className="font-bold text-primary text-base">1. Pickup Ready Time Calculation</span>
                    <span className="text-sm text-amber font-semibold">Temporal Buffer</span>
                  </div>
                  <pre className="p-3.5 rounded-lg bg-ink-950 border border-ink-800 text-amber text-sm overflow-x-auto leading-relaxed">
{`ready_time = scheduled_arrival + delay_min + EXIT_BUFFER(flight_kind, checked_bags)`}
                  </pre>
                  <p className="text-secondary text-sm font-sans leading-relaxed">
                    Guarantees travellers are not matched for pickup until luggage collection and immigration are accounted for.
                  </p>
                </div>

                {/* 2. Group Departure & Extra Wait */}
                <div className="p-5 rounded-xl bg-ink-900 border border-ink-800 space-y-2">
                  <div className="flex items-center justify-between text-secondary">
                    <span className="font-bold text-primary text-base">2. Group Departure & Wait Feasibility</span>
                    <span className="text-sm text-amber font-semibold">Synchronization Constraint</span>
                  </div>
                  <pre className="p-3.5 rounded-lg bg-ink-950 border border-ink-800 text-amber text-sm overflow-x-auto leading-relaxed">
{`depart(G) = max(ready_i for i in G)
extra_wait_i = depart(G) - ready_i <= max_wait_i  (for all i in G)`}
                  </pre>
                  <p className="text-secondary text-sm font-sans leading-relaxed">
                    The group departs only when the last member arrives at the pickup curb. If this forces any rider to wait beyond their declared max wait preference, the group is strictly invalid.
                  </p>
                </div>

                {/* 3. Proportional Fare Splitting */}
                <div className="p-5 rounded-xl bg-ink-900 border border-ink-800 space-y-2">
                  <div className="flex items-center justify-between text-secondary">
                    <span className="font-bold text-primary text-base">3. Proportional Fare Splitting Formula</span>
                    <span className="text-sm text-green font-semibold">Equitable Proration</span>
                  </div>
                  <pre className="p-3.5 rounded-lg bg-ink-950 border border-ink-800 text-green text-sm overflow-x-auto leading-relaxed">
{`fixed_fees = FARE_BASE + AIRPORT_ACCESS_FEE + TOLL_FEE
fixed_share_i = fixed_fees * (seats_i / total_seats)

dist_share_i = (PER_KM * multiplier * shared_km) * ( (solo_km_i * seats_i) / sum(solo_km_j * seats_j) )

fare_share_i = fixed_share_i + dist_share_i`}
                  </pre>
                  <p className="text-secondary text-sm font-sans leading-relaxed">
                    Fixed overheads (Rs 370 airport gate entry & highway toll) split evenly across seats. Highway distance fuel and wear is prorated proportionally to each rider&apos;s journey length.
                  </p>
                </div>

                {/* 4. Avoided Emissions */}
                <div className="p-5 rounded-xl bg-ink-900 border border-ink-800 space-y-2">
                  <div className="flex items-center justify-between text-secondary">
                    <span className="font-bold text-primary text-base">4. Avoided Vehicle Kilometers & CO2 Equivalence</span>
                    <span className="text-sm text-green font-semibold">Emissions Model</span>
                  </div>
                  <pre className="p-3.5 rounded-lg bg-ink-950 border border-ink-800 text-green text-sm overflow-x-auto leading-relaxed">
{`km_avoided = sum(solo_km_i for i in G) - shared_km
co2_avoided_kg = km_avoided * 0.17 kg/km
tree_days_equivalent = (co2_avoided_kg / 21.0 kg/yr) * 365 days`}
                  </pre>
                  <p className="text-secondary text-sm font-sans leading-relaxed">
                    Avoided distance is the delta between separate solo vehicles and the combined pooled corridor.
                  </p>
                </div>
              </div>
            </section>

            {/* 04. Platform Limits */}
            <section id="limits" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-2">
                <span className="font-cockpit text-amber text-sm font-bold">04</span>
                <h2 className="text-2xl font-bold font-sans text-primary">
                  Platform Limits & Transparency
                </h2>
              </div>
              <RunwayDash />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="p-5 rounded-xl bg-ink-900 border border-ink-800 space-y-2">
                  <h3 className="font-bold text-primary font-sans">Trip Scope</h3>
                  <p className="text-secondary text-xs leading-relaxed font-sans">
                    EcoRide Share matches only outbound trips departing Kempegowda International Airport (BLR) to Bengaluru metropolitan zones. City-to-airport outbound runs are not currently matched.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-ink-900 border border-ink-800 space-y-2">
                  <h3 className="font-bold text-primary font-sans">Fare Accuracy</h3>
                  <p className="text-secondary text-xs leading-relaxed font-sans">
                    All fares presented are estimates (<span className="font-cockpit text-amber">est.</span>). Exact cab charges are billed directly by the selected taxi operator (Uber, Ola, Rapido, Namma Yatri) subject to real-time surge and night rates.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-ink-900 border border-ink-800 space-y-2">
                  <h3 className="font-bold text-primary font-sans">Flight Schedules</h3>
                  <p className="text-secondary text-xs leading-relaxed font-sans">
                    Scheduled landing times are entered directly by passengers from their boarding pass or ticket confirmation. Delay chips allow passengers to notify their pool in real time.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-ink-900 border border-ink-800 space-y-2">
                  <h3 className="font-bold text-primary font-sans">Women-Only Matching</h3>
                  <p className="text-secondary text-xs leading-relaxed font-sans">
                    The women-only pool preference is self-declared during check-in. The matching algorithm strictly isolates women-only requests into dedicated groups without mixed-gender pairing.
                  </p>
                </div>
              </div>
            </section>

            {/* 05. Privacy Architecture */}
            <section id="privacy" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-2">
                <span className="font-cockpit text-amber text-sm font-bold">05</span>
                <h2 className="text-2xl font-bold font-sans text-primary">
                  Privacy Architecture
                </h2>
              </div>
              <RunwayDash />
              <div className="p-6 rounded-xl bg-ink-900 border border-ink-800 space-y-4 text-sm font-sans">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green/10 border border-green/30 flex items-center justify-center text-green font-cockpit font-bold text-xs">
                    0-PII
                  </div>
                  <div>
                    <h3 className="font-bold text-primary">No Persistent Personal Accounts</h3>
                    <p className="text-xs text-secondary">
                      No email addresses, phone numbers, passwords, payment instruments, or PNR confirmation codes are collected.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber/10 border border-amber/30 flex items-center justify-center text-amber font-cockpit font-bold text-xs">
                    24H
                  </div>
                  <div>
                    <h3 className="font-bold text-primary">Automatic 24-Hour Ephemeral Purge</h3>
                    <p className="text-xs text-secondary">
                      Trips, invites and groups are deleted 24 hours after they are created. Exact addresses and drop details are shown only to the person booking, only after everyone says yes, and are deleted as soon as the trip ends or is cancelled. They never appear in URLs or logs.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 border border-ink-700 flex items-center justify-center text-primary font-cockpit font-bold text-xs">
                    SEC
                  </div>
                  <div>
                    <h3 className="font-bold text-primary">Single-Use Curb Codes</h3>
                    <p className="text-xs text-secondary">
                      A randomly generated 4-digit pickup curb verification code is issued only to confirmed members of a group to confirm in-person rendezvous at the airport taxi stand.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* 06. What can go wrong */}
            <section id="what-can-go-wrong" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-2">
                <span className="font-cockpit text-amber text-sm font-bold">06</span>
                <h2 className="text-2xl font-bold font-sans text-primary">What can go wrong</h2>
              </div>
              <RunwayDash />
              <div className="divide-y divide-ink-800 rounded-xl border border-ink-800 bg-ink-900/60">
                {[
                  {
                    t: 'Nobody on your flight is going your way',
                    b: 'Matching only works when enough people land around the same time and head the same way. Late at night, or to a less common area, you may find nobody. We keep looking until you land, you can send an invite link to someone on your flight, and you can book alone at any time.',
                  },
                  {
                    t: 'The estimate isn’t the real fare',
                    b: 'Every rupee figure before the ride is an estimate from the fare model above, using road distances from OSRM or a straight-line distance times 1.35 when OSRM is unavailable. Surge, night charges, traffic and the route the driver takes all change the real fare. After the ride the person booking enters the actual fare and the shares are recalculated with the same method.',
                  },
                  {
                    t: 'Some entries are self-declared',
                    b: 'Landing time, flight number, age and the women-only preference are what people tell us. We can’t verify them. The 4-digit pickup code only confirms that everyone at the curb is in the same group; it says nothing about who they are.',
                  },
                  {
                    t: 'The cab app sets the price',
                    b: 'We don’t run cabs, take payments or set prices. Uber, Ola, Rapido or Namma Yatri decide the fare, the cab size and whether a driver accepts a multi-stop trip. If the cab app quotes much more than our estimate, the group can decide not to book.',
                  },
                ].map((item) => (
                  <div key={item.t} className="p-5 space-y-1.5">
                    <h3 className="font-bold text-primary font-sans">{item.t}</h3>
                    <p className="text-secondary text-sm leading-relaxed font-sans">{item.b}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
