import React, { useEffect, useRef, useState } from 'react';
import { ImpactMetrics, PublicConfig } from '../types';
import { fareExample, round10 } from '../lib/fare';
import { navigate } from '../router';
import { ConvergenceMap } from './primitives/ConvergenceMap';
import { FareSplitCalculator } from './primitives/FareSplitCalculator';
import { DigitRoll } from './primitives/DigitRoll';
import { Logo } from './Header';
import { FAQ } from '../content';
import { InteractiveTicket } from './primitives/InteractiveTicket';
import { FlightArrivalsTicker } from './primitives/FlightArrivalsTicker';
import { OldVsEcoRideComparison } from './primitives/OldVsEcoRideComparison';
import { InteractiveJourneyDeck } from './primitives/InteractiveJourneyDeck';
import { FlightStageCards } from './primitives/FlightStageCards';
import { TrustSafetyGrid } from './primitives/TrustSafetyGrid';
import { airportAudio } from '../lib/chime';

interface LandingViewProps {
  config: PublicConfig | null;
  impact: ImpactMetrics | null;
  onStart: () => void;
  onWatch?: () => void;
}

const inr = (n: number) => `Rs ${new Intl.NumberFormat('en-IN').format(round10(n))}`;

/** A plain question above each section's answer. Sentence case. */
const Question: React.FC<{ children: React.ReactNode; id?: string }> = ({ children, id }) => (
  <p id={id} className="text-sm font-cockpit font-bold uppercase tracking-wider text-amber">
    {children}
  </p>
);

export const LandingView: React.FC<LandingViewProps> = ({ config, impact, onStart }) => {
  const heroRef = useRef<HTMLElement>(null);
  const [pastHero, setPastHero] = useState(false);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setPastHero(!e.isIntersecting), { rootMargin: '-64px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const ex = config ? fareExample(config, 'Jayanagar', 3) : null;

  return (
    <div className="relative min-h-screen bg-ink-950 text-primary">
      {/* Top bar: always shows the brand and a way in */}
      <header className="sticky top-0 z-[800] h-16 border-b border-ink-800 bg-ink-950/90 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-6 text-[15px] text-secondary lg:flex" aria-label="Page">
            <a href="#problem" className="hover:text-primary transition-colors">The Problem</a>
            <a href="#journey" className="hover:text-primary transition-colors">Live Journey</a>
            <a href="#how" className="hover:text-primary transition-colors">How it works</a>
            <a href="#save" className="hover:text-primary transition-colors">Fare Calculator</a>
            <a href="#safe" className="hover:text-primary transition-colors">Safety</a>
            <a href="#questions" className="hover:text-primary transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <a
              href="#journey"
              className="hidden text-[15px] font-cockpit text-secondary hover:text-amber sm:inline transition-colors"
            >
              Interactive Tour ↓
            </a>
            <button
              type="button"
              onClick={() => {
                airportAudio.playChime();
                onStart();
              }}
              className="btn-primary h-10 whitespace-nowrap px-5 text-[15px] font-bold"
            >
              Find a cab share &rarr;
            </button>
          </div>
        </div>
      </header>

      {/* 1. HERO — The Absolute Banger Showpiece */}
      <section ref={heroRef} className="relative overflow-hidden border-b border-ink-800" data-demo="hero">
        <div className="absolute inset-0 amber-glow pointer-events-none" />
        <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-12 lg:py-24">
          <div className="space-y-6 lg:col-span-7">
            <h1 className="max-w-3xl text-[44px] font-extrabold leading-[0.95] tracking-tight sm:text-7xl lg:text-[88px]">
              You landed together.
              <br />
              <span className="text-secondary">Leave together.</span>
            </h1>
            <p className="max-w-[44ch] text-lg leading-relaxed text-secondary sm:text-xl">
              EcoRide Share matches you with people landing at Bengaluru airport around the same time and heading your way,
              so you split one cab instead of paying for your own.
            </p>

            {/* Mobile ticket stats */}
            <div className="ticket-card px-5 py-4 lg:hidden" data-demo="hero-stat">
              <div className="flex items-center justify-between text-[13px] text-on-paper/70 font-cockpit">
                <span>Airport &rarr; Jayanagar</span>
                <span>est.</span>
              </div>
              <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-on-paper/70 font-cockpit">
                  Alone <span className="whitespace-nowrap font-semibold text-on-paper line-through decoration-on-paper/40">{ex ? inr(ex.soloFare) : '…'}</span>
                </span>
                <span className="text-on-paper/70 font-cockpit">
                  With 3 people, each <span className="whitespace-nowrap text-xl font-extrabold text-green-ink">{ex ? inr(ex.perPerson) : '…'}</span>
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => {
                  airportAudio.playChime();
                  onStart();
                }}
                className="btn-primary h-14 px-8 text-[17px] font-bold"
                data-demo="hero-cta"
              >
                Find a cab share <span aria-hidden="true">&rarr;</span>
              </button>
              <a
                href="#journey"
                className="btn-secondary h-14 px-6 text-[16px] inline-flex items-center justify-center gap-2 font-cockpit text-secondary hover:text-primary"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polygon points="10 8 16 12 10 16 10 8" />
                </svg>
                Explore Live Journey (4 Steps)
              </a>
            </div>
            <p className="text-[14px] font-cockpit text-secondary">
              No account. 0% commission. We don’t run the cabs or touch your money.
            </p>
          </div>

          {/* 3D Physical Boarding Pass Ticket */}
          <div className="hidden lg:col-span-5 lg:block">
            <InteractiveTicket
              soloFareText={ex ? inr(ex.soloFare) : '…'}
              perPersonText={ex ? inr(ex.perPerson) : '…'}
              savingText={ex ? inr(ex.saving) : '…'}
              destination="Jayanagar"
            />
          </div>
        </div>

        {/* Live Flight Arrivals Mechanical Board */}
        <div className="relative mx-auto max-w-7xl px-4 pb-8 sm:px-6">
          <FlightArrivalsTicker />
        </div>
      </section>

      {/* 2. THE PROBLEM — Convergence Map & Two Ways to Leave */}
      <section id="problem" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28 space-y-12">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-4">
            <Question>What’s the problem?</Question>
            <h2 className="text-3xl font-extrabold leading-[1.05] sm:text-5xl">
              11:45 pm. 12 passengers. 12 cabs. Same road.
            </h2>
            <p className="text-base sm:text-lg leading-relaxed text-secondary">
              Late flights land in waves. People off the same plane, going to the same part of town, each pay the full airport
              fare and take the same 40 km highway alone.
            </p>
          </div>
          <div className="lg:col-span-8">
            <ConvergenceMap />
          </div>
        </div>

        {/* Old Way vs EcoRide Share Side-by-Side Comparison */}
        <OldVsEcoRideComparison />
      </section>

      {/* 3. INTERACTIVE JOURNEY COCKPIT — Replaces the 75-second automated video */}
      <section id="journey" className="scroll-mt-20 border-y border-ink-800 bg-ink-900/40 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-6">
          <div className="max-w-3xl space-y-3">
            <Question>Live Interactive Journey</Question>
            <h2 className="text-3xl font-extrabold leading-[1.05] sm:text-5xl">
              From landing gate to your door in 4 simple beats.
            </h2>
            <p className="text-base sm:text-lg leading-relaxed text-secondary">
              No lengthy videos to watch. Tap or scrub through the active steps below to test the full live passenger experience:
            </p>
          </div>

          {/* Interactive 4-Stage Cockpit Deck */}
          <div className="pt-4">
            <InteractiveJourneyDeck />
          </div>
        </div>
      </section>

      {/* 4. HOW DOES IT WORK — 4 Physical Flight Stage Cards */}
      <section id="how" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6 lg:py-28 space-y-10">
        <div className="max-w-3xl space-y-3">
          <Question>How does it work?</Question>
          <h2 className="text-3xl font-extrabold leading-[1.05] sm:text-5xl">
            Four steps. All on your phone.
          </h2>
          <p className="text-base sm:text-lg text-secondary">
            Engineered as an open coordination utility. Transparent at every milestone.
          </p>
        </div>

        <FlightStageCards />
      </section>

      {/* 5. WHAT DO I SAVE — Airport Meter & Split Calculator */}
      <section id="save" className="mx-auto max-w-7xl scroll-mt-20 px-4 pb-20 sm:px-6 lg:pb-28 space-y-8">
        <div className="max-w-3xl space-y-3">
          <Question>Transparent Fare Math</Question>
          <h2 className="text-3xl font-extrabold leading-[1.05] sm:text-5xl">
            Airport tolls and highway fees, split between you.
          </h2>
          <p className="text-base sm:text-lg text-secondary">
            Use the simulator below to inspect exact rupee savings for your destination area.
          </p>
        </div>

        <FareSplitCalculator config={config} />
      </section>

      {/* 6. IS IT SAFE — 6 Pillars of Trust & Ephemeral Privacy */}
      <section id="safe" className="scroll-mt-20 border-y border-ink-800 bg-ink-900/40 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-10">
          <div className="max-w-3xl space-y-3">
            <Question>Trust & Personal Safety</Question>
            <h2 className="text-3xl font-extrabold leading-[1.05] sm:text-5xl">
              Built for midnight landings. Zero permanent tracking.
            </h2>
            <p className="text-base sm:text-lg text-secondary">
              We collect no passwords, phone numbers, or credit cards. All trip data automatically purges after 24 hours.
            </p>
          </div>

          <TrustSafetyGrid />
        </div>
      </section>

      {/* 7. WHAT DIFFERENCE DOES IT MAKE — Environmental Impact Telemetry */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28 space-y-10">
        <div className="max-w-3xl space-y-3">
          <div className="flex items-center gap-2">
            <Question>Environmental & Highway Telemetry</Question>
            <span className="demo-chip text-[10px]">Real-time simulation</span>
          </div>
          <h2 className="text-3xl font-extrabold leading-[1.05] sm:text-5xl">
            Fewer solo cabs idling on Bellary Road.
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {[
            { v: impact?.co2_saved_kg ?? 105.6, label: 'kg of CO2 avoided, est.', green: true, suffix: ' kg', note: 'Equivalent to 5 trees planted' },
            { v: impact?.km_saved ?? 621.6, label: 'km of highway not driven', green: false, suffix: ' km', note: 'Eliminates Bellary Road dead mileage' },
            { v: impact?.cabs_avoided ?? 20, label: 'solo cabs removed from curb', green: false, suffix: ' cabs', note: 'Less congestion at T1/T2 app pickup' },
            { v: impact?.avg_saving_pct ?? 73.9, label: 'average savings per passenger', green: true, suffix: '%', note: '₹1,030 stays in your pocket' },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-ink-800 bg-ink-900/60 p-5 sm:p-6 backdrop-blur space-y-2">
              <span className="font-cockpit text-[11px] text-secondary/70 uppercase tracking-wider block">
                {s.label}
              </span>
              <div className={`text-4xl sm:text-6xl font-extrabold tracking-tight font-cockpit ${s.green ? 'text-green' : 'text-primary'}`}>
                <DigitRoll value={Math.round(s.v * 10) / 10} suffix={s.suffix} />
              </div>
              <p className="text-xs text-secondary/70 font-cockpit pt-1 border-t border-ink-800/60">
                {s.note}
              </p>
            </div>
          ))}
        </div>

        <p className="text-sm font-cockpit text-secondary">
          Telemetry based on current simulated arrival waves.{' '}
          <button type="button" className="link text-amber hover:underline" onClick={() => navigate('/methodology')}>
            Inspect full mathematical methodology &rarr;
          </button>
        </p>
      </section>

      {/* 8. QUESTIONS — High-Density Passenger FAQ */}
      <section id="questions" className="mx-auto max-w-4xl scroll-mt-20 px-4 pb-20 sm:px-6 lg:pb-28 space-y-8">
        <div className="space-y-3">
          <Question>Passenger FAQ</Question>
          <h2 className="text-3xl font-extrabold sm:text-5xl">What people ask first.</h2>
        </div>

        <div className="divide-y divide-ink-800 border-y border-ink-800">
          {FAQ.map((f) => (
            <details key={f.q} className="group py-5 transition-all">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg sm:text-xl font-bold hover:text-amber transition-colors">
                {f.q}
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-700 font-cockpit text-lg text-secondary transition-transform group-open:rotate-45 group-open:text-amber" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-[64ch] text-base leading-relaxed text-secondary pl-1 font-sans">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* 9. FINAL CTA — Departure Gate Boarding Card */}
      <section className="border-t border-ink-800 bg-ink-900/30">
        <div className="relative mx-auto max-w-5xl overflow-hidden px-4 py-20 text-center sm:px-6">
          <div className="absolute inset-0 amber-glow pointer-events-none" />

          <div className="relative inline-flex items-center gap-2 rounded-full border border-amber/30 bg-amber/10 px-4 py-1.5 font-cockpit text-xs text-amber font-bold uppercase tracking-wider mb-6">
            <span className="h-2 w-2 rounded-full bg-green animate-pulse" />
            GATE BLR-01 · BOARDING OPEN TONIGHT
          </div>

          <h2 className="relative text-3xl font-black sm:text-6xl tracking-tight">
            Landing soon at Kempegowda?
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-base sm:text-lg text-secondary">
            Two simple questions. We'll match you with fellow passengers heading down your road.
          </p>

          <div className="relative mt-8 flex flex-col justify-center items-center gap-4 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                airportAudio.playChime();
                onStart();
              }}
              className="btn-primary h-14 px-9 text-[17px] font-bold shadow-xl shadow-paper/10"
            >
              Find a cab share <span aria-hidden="true">&rarr;</span>
            </button>
            <a
              href="#journey"
              className="btn-secondary h-14 px-6 text-[15px] font-cockpit text-secondary hover:text-primary"
            >
              Explore Interactive Tour &uarr;
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-ink-800 pb-28 md:pb-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-md space-y-2">
            <Logo />
            <p className="text-sm text-secondary leading-relaxed">
              An open, zero-commission airport cab sharing utility for Kempegowda International Airport (BLR).
              We do not run cabs, collect fares, or sell rider data.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-3 text-[14px] font-cockpit text-secondary" aria-label="Footer">
            <button type="button" className="hover:text-primary transition-colors" onClick={() => navigate('/trip')}>Find a cab share</button>
            <button type="button" className="hover:text-primary transition-colors" onClick={() => navigate('/demo')}>Two-phone demo</button>
            <button type="button" className="hover:text-primary transition-colors" onClick={() => navigate('/impact')}>Impact</button>
            <button type="button" className="hover:text-primary transition-colors" onClick={() => navigate('/help')}>Help</button>
            <button type="button" className="hover:text-primary transition-colors" onClick={() => navigate('/methodology')}>How we estimate</button>
            <button type="button" className="hover:text-primary transition-colors" onClick={() => navigate('/admin')}>Operations</button>
          </nav>
        </div>
      </footer>

      {/* Sticky call to action on phones once the hero has scrolled away */}
      <div
        className={`fixed inset-x-0 bottom-0 z-[700] border-t border-ink-800 bg-ink-950/95 p-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur transition-transform duration-200 md:hidden ${
          pastHero ? 'translate-y-0' : 'translate-y-full'
        }`}
        aria-hidden={!pastHero}
        data-demo="sticky-cta"
      >
        <button
          type="button"
          onClick={() => {
            airportAudio.playChime();
            onStart();
          }}
          className="btn-primary h-14 w-full text-[17px] font-bold"
          tabIndex={pastHero ? 0 : -1}
        >
          Find a cab share <span aria-hidden="true">&rarr;</span>
        </button>
      </div>
    </div>
  );
};
