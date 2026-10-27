import React, { useState, useEffect, useRef } from 'react';
import { airportAudio } from '../../lib/chime';
import { DigitRoll } from './DigitRoll';

interface DestinationOption {
  name: string;
  distanceKm: number;
  soloFare: number;
  sharedFare: number;
  saving: number;
  corridor: string;
}

const DESTINATIONS: DestinationOption[] = [
  { name: 'Jayanagar', distanceKm: 44, soloFare: 1620, sharedFare: 580, saving: 1030, corridor: 'South Spine' },
  { name: 'Indiranagar', distanceKm: 38, soloFare: 1450, sharedFare: 520, saving: 930, corridor: 'East Central' },
  { name: 'Koramangala', distanceKm: 42, soloFare: 1580, sharedFare: 560, saving: 1020, corridor: 'South East' },
  { name: 'Whitefield', distanceKm: 48, soloFare: 1750, sharedFare: 620, saving: 1130, corridor: 'ITPL Expressway' },
  { name: 'HSR Layout', distanceKm: 46, soloFare: 1680, sharedFare: 590, saving: 1090, corridor: 'ORR South' },
  { name: 'Electronic City', distanceKm: 56, soloFare: 1980, sharedFare: 690, saving: 1290, corridor: 'Elevated Tollway' },
];

export const InteractiveJourneyDeck: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [selectedDest, setSelectedDest] = useState<DestinationOption>(DESTINATIONS[0]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);
  const [settled, setSettled] = useState<boolean>(false);
  const [lockedGroup, setLockedGroup] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-play timer
  useEffect(() => {
    if (!isPlaying) {
      setProgress(0);
      return;
    }

    const interval = 50; // update progress every 50ms
    const stepDuration = 5500; // 5.5s per card
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setActiveStep((s) => (s + 1) % 4);
          airportAudio.playChime();
          return 0;
        }
        return prev + (interval / stepDuration) * 100;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [isPlaying, activeStep]);

  const goToStep = (step: number) => {
    setActiveStep(step);
    setProgress(0);
    airportAudio.playChime();
  };

  const steps = [
    { num: '01', title: 'Touchdown & Radar', subtitle: '11:45 PM · BLR Terminal 1 & 2' },
    { num: '02', title: 'Corridor Match', subtitle: '11:47 PM · 3 Travellers Matched' },
    { num: '03', title: 'Curb Boarding Pass', subtitle: '11:58 PM · Lane 2, Pillar 4' },
    { num: '04', title: 'Zero-Fee UPI Split', subtitle: '00:45 AM · At Destination' },
  ];

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-3xl border border-ink-800 bg-ink-900/80 p-5 sm:p-8 lg:p-10 backdrop-blur-xl shadow-2xl overflow-hidden"
      data-demo="journey-deck"
    >
      {/* Background radial glow */}
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-amber/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-green/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-ink-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green animate-pulse" />
            <span className="font-cockpit text-xs font-semibold text-green tracking-wider">
              Interactive Flight-to-Cab Cockpit
            </span>
            <span className="text-ink-700">|</span>
            <span className="font-cockpit text-xs text-secondary">Zero video · Click or scrub any step</span>
          </div>
          <h3 className="mt-1 text-2xl sm:text-3xl font-extrabold text-primary tracking-tight">
            How a share happens in under 4 minutes
          </h3>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold font-cockpit transition-all ${
              isPlaying
                ? 'bg-amber text-ink-950 shadow-md shadow-amber/20'
                : 'border border-ink-700 bg-ink-950 text-secondary hover:text-primary hover:border-ink-600'
            }`}
          >
            {isPlaying ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
                Auto-playing ({activeStep + 1}/4)
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Auto-play tour
              </>
            )}
          </button>
        </div>
      </div>

      {/* Step Scrubber Navigation Tabs */}
      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3" role="tablist">
        {steps.map((s, idx) => {
          const isActive = activeStep === idx;
          return (
            <button
              key={s.num}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => goToStep(idx)}
              className={`relative text-left p-3.5 sm:p-4 rounded-2xl border transition-all overflow-hidden ${
                isActive
                  ? 'border-amber/80 bg-ink-950 shadow-lg ring-1 ring-amber/50'
                  : 'border-ink-800 bg-ink-950/50 hover:bg-ink-800/50 hover:border-ink-700'
              }`}
            >
              {/* Progress bar for auto-play */}
              {isActive && isPlaying && (
                <div
                  className="absolute bottom-0 left-0 top-0 bg-amber/10 transition-all pointer-events-none"
                  style={{ width: `${progress}%` }}
                />
              )}
              <div className="relative flex items-center justify-between text-xs font-cockpit font-semibold">
                <span className={isActive ? 'text-amber' : 'text-secondary'}>STEP {s.num}</span>
                {isActive && <span className="h-1.5 w-1.5 rounded-full bg-amber" />}
              </div>
              <div className={`relative mt-1 text-sm sm:text-base font-bold ${isActive ? 'text-primary' : 'text-secondary'}`}>
                {s.title}
              </div>
              <div className="relative mt-0.5 text-xs text-secondary/70 truncate">{s.subtitle}</div>
            </button>
          );
        })}
      </div>

      {/* Active Stage Body */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Interactive Controls & Explanation */}
        <div className="lg:col-span-6 space-y-6">
          {activeStep === 0 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber/30 bg-amber/10 px-3 py-1 font-cockpit text-xs text-amber font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-amber animate-pulse" />
                STAGE 1: PASSENGER ARRIVAL RADAR
              </div>
              <h4 className="text-2xl sm:text-3xl font-extrabold text-primary leading-tight">
                You land at Terminal 1. Who else is heading your way?
              </h4>
              <p className="text-secondary text-base leading-relaxed">
                Flights land in waves every 15 minutes. Select your Bangalore destination to see how EcoRide matches travellers landing on the same wave heading down Bellary Road:
              </p>

              {/* Destination selector chips */}
              <div className="space-y-2">
                <span className="block text-xs font-cockpit text-secondary">SELECT DESTINATION CORRIDOR:</span>
                <div className="flex flex-wrap gap-2">
                  {DESTINATIONS.map((d) => (
                    <button
                      key={d.name}
                      type="button"
                      onClick={() => {
                        setSelectedDest(d);
                        airportAudio.playChime();
                      }}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold font-cockpit transition-all ${
                        selectedDest.name === d.name
                          ? 'bg-amber text-ink-950 font-bold shadow-md'
                          : 'border border-ink-800 bg-ink-950 text-secondary hover:text-primary hover:border-ink-700'
                      }`}
                    >
                      {d.name} ({d.distanceKm} km)
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Wave Flight Scanner */}
              <div className="rounded-2xl border border-ink-800 bg-ink-950 p-4 space-y-2.5 font-cockpit text-xs">
                <div className="flex items-center justify-between text-secondary pb-1 border-b border-ink-800">
                  <span>TOUCHDOWN WAVE (11:30 – 11:50 PM)</span>
                  <span className="text-green">3 FLIGHTS LANDED</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-primary font-bold">6E 2134 · DEL &rarr; BLR T1</span>
                  <span className="text-secondary">On time (11:42 PM)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-primary font-bold">AI 506 · BOM &rarr; BLR T2</span>
                  <span className="text-secondary">On time (11:45 PM)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-primary font-bold">QP 1302 · HYD &rarr; BLR T1</span>
                  <span className="text-secondary">On time (11:48 PM)</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => goToStep(1)}
                  className="btn-primary h-12 px-6 text-sm font-bold w-full sm:w-auto"
                >
                  View Matched Corridor &rarr;
                </button>
              </div>
            </div>
          )}

          {activeStep === 1 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="inline-flex items-center gap-2 rounded-full border border-green/30 bg-green/10 px-3 py-1 font-cockpit text-xs text-green font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-green" />
                STAGE 2: ALGORITHMIC CORRIDOR MATCHING
              </div>
              <h4 className="text-2xl sm:text-3xl font-extrabold text-primary leading-tight">
                3 travellers, 1 shared cab down Bellary Road
              </h4>
              <p className="text-secondary text-base leading-relaxed">
                Rather than 3 individual cabs incurring ₹1,620 each, the system groups passengers based on route drop efficiency. Stops are pre-sequenced along the corridor:
              </p>

              {/* Co-passengers cards */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between rounded-xl border border-ink-800 bg-ink-950 p-3.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber/20 font-cockpit text-xs font-bold text-amber">
                      M
                    </span>
                    <div>
                      <span className="font-bold text-primary block text-sm">Meera</span>
                      <span className="text-xs text-secondary font-cockpit">Drop 1 · Indiranagar 100ft Rd (28 km)</span>
                    </div>
                  </div>
                  <span className="font-cockpit text-xs font-bold text-green">₹520 share</span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-ink-800 bg-ink-950 p-3.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber/20 font-cockpit text-xs font-bold text-amber">
                      A
                    </span>
                    <div>
                      <span className="font-bold text-primary block text-sm">Arjun</span>
                      <span className="text-xs text-secondary font-cockpit">Drop 2 · Domlur Flyover (34 km)</span>
                    </div>
                  </div>
                  <span className="font-cockpit text-xs font-bold text-green">₹560 share</span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-green/50 bg-green/5 p-3.5 ring-1 ring-green/30">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green font-cockpit text-xs font-bold text-ink-950">
                      YOU
                    </span>
                    <div>
                      <span className="font-bold text-primary block text-sm">You</span>
                      <span className="text-xs text-secondary font-cockpit">Drop 3 · {selectedDest.name} ({selectedDest.distanceKm} km)</span>
                    </div>
                  </div>
                  <span className="font-cockpit text-sm font-extrabold text-green">₹{selectedDest.sharedFare} share</span>
                </div>
              </div>

              {/* Action */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setLockedGroup(true);
                    goToStep(2);
                  }}
                  className="btn-primary h-12 px-6 text-sm font-bold w-full sm:w-auto"
                >
                  Accept & Lock Curb Pass &rarr;
                </button>
                <span className="text-xs text-secondary font-cockpit">Locks in under 120 seconds</span>
              </div>
            </div>
          )}

          {activeStep === 2 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber/30 bg-amber/10 px-3 py-1 font-cockpit text-xs text-amber font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-amber" />
                STAGE 3: CURB HANDSHAKE & 1-TAP DISPATCH
              </div>
              <h4 className="text-2xl sm:text-3xl font-extrabold text-primary leading-tight">
                Meet at Lane 2, Pillar 4. Verify the 4-digit code.
              </h4>
              <p className="text-secondary text-base leading-relaxed">
                No awkward searching. The app provides exact pillar wayfinding and a synchronized 4-digit verification code. One traveller taps to book the cab via Uber/Ola with all stops pre-loaded:
              </p>

              <div className="rounded-2xl border border-ink-800 bg-ink-950 p-4 space-y-3 font-cockpit text-xs">
                <div className="flex items-center justify-between text-secondary pb-1 border-b border-ink-800">
                  <span>PICKUP ZONE DISPATCH</span>
                  <span className="text-amber">TERMINAL 1 (P3)</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-secondary block text-xs">Assigned Curb</span>
                    <span className="text-primary font-bold">Lane 2, Pillar 4</span>
                  </div>
                  <div>
                    <span className="text-secondary block text-xs">Designated Booker</span>
                    <span className="text-primary font-bold">Meera (Uber Sedan)</span>
                  </div>
                </div>
                <div className="rounded-xl bg-ink-900 p-3 text-secondary text-xs">
                  👉 Uber deep-link auto-populates stops: T1 &rarr; Indiranagar &rarr; Domlur &rarr; {selectedDest.name}.
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => goToStep(3)}
                  className="btn-primary h-12 px-6 text-sm font-bold w-full sm:w-auto"
                >
                  See Fair Settlement Breakdown &rarr;
                </button>
              </div>
            </div>
          )}

          {activeStep === 3 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="inline-flex items-center gap-2 rounded-full border border-green/30 bg-green/10 px-3 py-1 font-cockpit text-xs text-green font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-green" />
                STAGE 4: ZERO COMMISSION UPI PRORATION
              </div>
              <h4 className="text-2xl sm:text-3xl font-extrabold text-primary leading-tight">
                Direct UPI settlement. Zero cuts. Total transparency.
              </h4>
              <p className="text-secondary text-base leading-relaxed">
                EcoRide never touches your money. When the ride concludes, fixed airport fees (toll & terminal entry) are split equally, and road distance is prorated based on each rider’s drop kilometer:
              </p>

              <div className="rounded-2xl border border-ink-800 bg-ink-950 p-4 space-y-3 font-cockpit text-xs">
                <div className="flex items-center justify-between text-secondary pb-1 border-b border-ink-800">
                  <span>DISPATCH MATH VERIFICATION</span>
                  <span className="text-green">0% PLATFORM FEE</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-secondary">Airport Toll (₹120) &divide; 3</span>
                    <span className="text-primary font-bold">₹40.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Airport Entry Fee (₹250) &divide; 3</span>
                    <span className="text-primary font-bold">₹83.33</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Road Distance Proration ({selectedDest.distanceKm} km)</span>
                    <span className="text-primary font-bold">₹{(selectedDest.sharedFare - 123.33).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-ink-800 text-sm">
                    <span className="text-primary font-bold">Your Total Share</span>
                    <span className="text-green font-extrabold text-base">₹{selectedDest.sharedFare}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSettled(true);
                    airportAudio.playChime();
                  }}
                  className={`h-12 px-6 rounded-full text-sm font-bold font-cockpit transition-all w-full sm:w-auto ${
                    settled
                      ? 'bg-green text-ink-950'
                      : 'bg-paper text-ink-950 hover:opacity-90'
                  }`}
                >
                  {settled ? '✓ Share Settled via UPI' : 'Simulate 1-Tap UPI Settlement'}
                </button>
                <button
                  type="button"
                  onClick={() => goToStep(0)}
                  className="btn-quiet text-xs text-secondary hover:text-primary font-cockpit"
                >
                  Restart Tour &circlearrowleft;
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Physical Ticket / Live Screen Render */}
        <div className="lg:col-span-6 flex justify-center">
          {activeStep === 0 && (
            /* Radar / Touchdown Card */
            <div className="w-full max-w-md rounded-2xl border border-ink-800 bg-ink-950 p-6 shadow-2xl relative overflow-hidden space-y-5">
              <div className="flex items-center justify-between border-b border-ink-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green" />
                  <span className="font-cockpit text-xs font-bold text-primary">LIVE RADAR · BLR AIRPORT</span>
                </div>
                <span className="font-cockpit text-xs text-amber">11:45 PM IST</span>
              </div>

              {/* Circular Radar Simulation */}
              <div className="relative h-48 w-full rounded-xl bg-ink-900 border border-ink-800 flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,176,32,0.1)_0%,transparent_70%)]" />
                <div className="absolute h-40 w-40 rounded-full border border-ink-700/60" />
                <div className="absolute h-24 w-24 rounded-full border border-ink-700/80" />
                <div className="absolute h-10 w-10 rounded-full border border-amber/40 bg-amber/10 flex items-center justify-center font-cockpit text-[10px] font-bold text-amber">
                  BLR
                </div>

                {/* Radar Sweep */}
                <div className="absolute inset-0 origin-center animate-spin" style={{ animationDuration: '4s' }}>
                  <div className="h-1/2 w-1/2 bg-gradient-to-br from-amber/20 to-transparent" />
                </div>

                {/* Detected passenger dots */}
                <div className="absolute top-10 left-16 flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-green ring-4 ring-green/20 animate-ping" />
                  <span className="font-cockpit text-[10px] font-semibold text-secondary">Meera (DEL)</span>
                </div>
                <div className="absolute bottom-12 right-20 flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-green ring-4 ring-green/20 animate-ping" />
                  <span className="font-cockpit text-[10px] font-semibold text-secondary">Arjun (BOM)</span>
                </div>
                <div className="absolute bottom-8 left-28 flex items-center gap-1">
                  <span className="h-3 w-3 rounded-full bg-amber ring-4 ring-amber/30" />
                  <span className="font-cockpit text-[10px] font-bold text-amber">You (HYD)</span>
                </div>
              </div>

              {/* Corridor Comparison Summary */}
              <div className="grid grid-cols-2 gap-3 font-cockpit">
                <div className="rounded-xl border border-ink-800 bg-ink-900/60 p-3">
                  <span className="text-[11px] text-secondary block">SOLO AIRPORT CAB</span>
                  <span className="text-lg font-bold text-primary line-through text-secondary/60">₹{selectedDest.soloFare}</span>
                  <span className="text-[10px] text-secondary block mt-0.5">Pay 100% of car alone</span>
                </div>
                <div className="rounded-xl border border-green/40 bg-green/10 p-3">
                  <span className="text-[11px] text-green block font-bold">WITH ECORIDE SHARE</span>
                  <span className="text-xl font-extrabold text-green">₹{selectedDest.sharedFare}</span>
                  <span className="text-[10px] text-green block mt-0.5">Save ₹{selectedDest.saving} (64%)</span>
                </div>
              </div>
            </div>
          )}

          {activeStep === 1 && (
            /* Vehicle Seats & Match Preview Card */
            <div className="w-full max-w-md rounded-2xl border border-ink-800 bg-ink-950 p-6 shadow-2xl relative space-y-5 font-cockpit">
              <div className="flex items-center justify-between border-b border-ink-800 pb-3 text-xs">
                <span className="font-bold text-primary">MATCH FORMED · SOUTH CORRIDOR</span>
                <span className="text-green font-bold">3 / 4 SEATS FILLED</span>
              </div>

              {/* Cab Top-Down Chassis Visualization */}
              <div className="rounded-2xl border border-ink-800 bg-ink-900/90 p-5 relative overflow-hidden">
                <div className="flex items-center justify-between text-xs text-secondary mb-4">
                  <span>SEDAN: TOYOTA ETIOS</span>
                  <span className="text-amber">LUGGAGE: 3 BAGS</span>
                </div>

                <div className="mx-auto w-48 rounded-3xl border-2 border-ink-700 bg-ink-950 p-4 space-y-4 shadow-inner">
                  {/* Front Row (Driver + Empty) */}
                  <div className="flex justify-between items-center px-2">
                    <div className="flex flex-col items-center">
                      <div className="h-8 w-8 rounded-lg border border-ink-700 bg-ink-800 flex items-center justify-center text-[10px] text-secondary">
                        CAB
                      </div>
                      <span className="text-[9px] text-secondary mt-1">Driver</span>
                    </div>
                    <div className="flex flex-col items-center opacity-40">
                      <div className="h-8 w-8 rounded-lg border border-dashed border-ink-600 flex items-center justify-center text-[10px] text-secondary">
                        -
                      </div>
                      <span className="text-[9px] text-secondary mt-1">Empty</span>
                    </div>
                  </div>

                  {/* Rear Row (3 Passengers) */}
                  <div className="flex justify-between items-center gap-1 border-t border-ink-800 pt-3">
                    <div className="flex flex-col items-center">
                      <div className="h-8 w-8 rounded-lg bg-green flex items-center justify-center text-xs font-bold text-ink-950">
                        YOU
                      </div>
                      <span className="text-[9px] text-green mt-1 font-bold">You</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="h-8 w-8 rounded-lg bg-amber flex items-center justify-center text-xs font-bold text-ink-950">
                        M
                      </div>
                      <span className="text-[9px] text-amber mt-1">Meera</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="h-8 w-8 rounded-lg bg-amber flex items-center justify-center text-xs font-bold text-ink-950">
                        A
                      </div>
                      <span className="text-[9px] text-amber mt-1">Arjun</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Multi-Drop Route Sequence */}
              <div className="space-y-2 text-xs">
                <span className="text-secondary block">CALCULATED STOP SEQUENCE:</span>
                <div className="space-y-1.5 border-l-2 border-dashed border-amber/60 pl-3 ml-2">
                  <div className="text-secondary">0 km &middot; BLR Airport Terminal 1 Curb</div>
                  <div className="text-secondary">28 km &middot; Stop 1: Indiranagar 100ft Rd (Meera)</div>
                  <div className="text-secondary">34 km &middot; Stop 2: Domlur Flyover (Arjun)</div>
                  <div className="text-green font-bold">{selectedDest.distanceKm} km &middot; Stop 3: {selectedDest.name} (You)</div>
                </div>
              </div>
            </div>
          )}

          {activeStep === 2 && (
            /* The Physical Boarding Pass */
            <div className="w-full max-w-md select-none transform hover:-translate-y-1 transition-transform duration-300">
              <div className="ticket-card p-6 relative overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between text-xs font-cockpit text-on-paper/70 border-b border-on-paper/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-ink inline-block" />
                    <span className="font-bold text-on-paper">BLR AIRPORT · CONFIRMED PASS</span>
                  </div>
                  <span className="rounded bg-on-paper/10 px-2 py-0.5 text-[10px] font-bold">TICKET #4892</span>
                </div>

                {/* Big Verification Code */}
                <div className="my-5 text-center">
                  <span className="block text-[11px] font-cockpit text-on-paper/60 tracking-widest">
                    HANDSHAKE CURB CODE
                  </span>
                  <div className="font-cockpit text-6xl font-extrabold tracking-widest text-on-paper my-1">
                    4 8 9 2
                  </div>
                  <span className="text-xs font-cockpit text-on-paper/80">
                    Verify this code with Meera & Arjun at the curb
                  </span>
                </div>

                {/* Perforation line */}
                <div className="relative my-4 flex items-center justify-between">
                  <div className="h-4 w-4 -ml-8 rounded-full bg-ink-950" />
                  <div className="w-full border-b-2 border-dashed border-on-paper/30" />
                  <div className="h-4 w-4 -mr-8 rounded-full bg-ink-950" />
                </div>

                {/* Wayfinding details */}
                <div className="grid grid-cols-2 gap-3 font-cockpit text-xs text-on-paper pt-1">
                  <div>
                    <span className="text-on-paper/60 block text-[10px]">PICKUP SPOT</span>
                    <span className="font-extrabold text-sm">Lane 2, Pillar 4</span>
                  </div>
                  <div>
                    <span className="text-on-paper/60 block text-[10px]">ASSIGNED VEHICLE</span>
                    <span className="font-extrabold text-sm">Sedan (Dzire)</span>
                  </div>
                </div>

                {/* Deep-link Action button */}
                <div className="mt-5 pt-3 border-t border-on-paper/10 flex items-center justify-between font-cockpit text-xs">
                  <span className="text-green-ink font-bold">✓ Booker dispatched</span>
                  <span className="text-on-paper/70 text-[11px]">Auto-purges in 24h</span>
                </div>
              </div>
            </div>
          )}

          {activeStep === 3 && (
            /* Physical Settlement Receipt */
            <div className="w-full max-w-md select-none">
              <div className="ticket-card p-6 relative overflow-hidden shadow-2xl space-y-4">
                <div className="flex items-center justify-between text-xs font-cockpit text-on-paper/70 border-b border-on-paper/10 pb-2">
                  <span className="font-bold text-on-paper">UPI SETTLEMENT RECEIPT</span>
                  <span className="text-green-ink font-bold">ZERO COMMISSION</span>
                </div>

                <div className="text-center py-2">
                  <span className="text-xs font-cockpit text-on-paper/60">YOUR SPLIT SHARE</span>
                  <div className="font-cockpit text-5xl font-black text-green-ink my-1">
                    ₹{selectedDest.sharedFare}
                  </div>
                  <span className="text-xs font-cockpit text-on-paper/70 line-through">
                    Alone: ₹{selectedDest.soloFare}
                  </span>
                </div>

                <div className="rounded-xl bg-on-paper/5 p-3 font-cockpit text-xs space-y-1.5 text-on-paper">
                  <div className="flex justify-between">
                    <span className="text-on-paper/70">Payee</span>
                    <span className="font-bold">Meera (Cab Booker)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-on-paper/70">UPI ID</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText('meera@okaxis');
                        setCopiedUpi(true);
                        setTimeout(() => setCopiedUpi(false), 2000);
                      }}
                      className="font-bold underline text-green-ink hover:opacity-80"
                    >
                      {copiedUpi ? '✓ Copied' : 'meera@okaxis'}
                    </button>
                  </div>
                </div>

                {/* Perforation */}
                <div className="relative my-2 flex items-center justify-between">
                  <div className="h-4 w-4 -ml-8 rounded-full bg-ink-950" />
                  <div className="w-full border-b border-dashed border-on-paper/30" />
                  <div className="h-4 w-4 -mr-8 rounded-full bg-ink-950" />
                </div>

                <div className="flex items-center justify-between text-xs font-cockpit text-on-paper/70 pt-1">
                  <span>TRIP STATUS: COMPLETE</span>
                  <span className="text-green-ink font-bold">100% PRIVATE</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
