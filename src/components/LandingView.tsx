import React, { useEffect, useRef, useState } from 'react';
import { ImpactMetrics, PublicConfig } from '../types';
import { fareExample, round10 } from '../lib/fare';
import { navigate } from '../router';
import { ConvergenceMap } from './primitives/ConvergenceMap';
import { FareSplitCalculator } from './primitives/FareSplitCalculator';
import { DigitRoll } from './primitives/DigitRoll';
import { PhoneMockup } from './PhoneMockup';
import { Logo, DemoChip } from './Header';
import { FAQ, STEPS, SAFETY } from '../content';
import { InteractiveTicket } from './primitives/InteractiveTicket';
import { FlightArrivalsTicker } from './primitives/FlightArrivalsTicker';
import { OldVsEcoRideComparison } from './primitives/OldVsEcoRideComparison';
import { StoryWaypoints } from './primitives/StoryWaypoints';

interface LandingViewProps {
  config: PublicConfig | null;
  impact: ImpactMetrics | null;
  onStart: () => void;
  onWatch: () => void;
}

const inr = (n: number) => `Rs ${new Intl.NumberFormat('en-IN').format(round10(n))}`;

const Check: React.FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3DDC97" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0">
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

/** A plain question above each section's answer. Sentence case, never an all-caps eyebrow. */
const Question: React.FC<{ children: React.ReactNode; id?: string }> = ({ children, id }) => (
  <p id={id} className="text-lg font-medium text-amber">
    {children}
  </p>
);

export const LandingView: React.FC<LandingViewProps> = ({ config, impact, onStart, onWatch }) => {
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
      <header className="sticky top-0 z-[800] h-16 border-b border-ink-800 bg-ink-950/90 backdrop-blur">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-6 text-[15px] text-secondary lg:flex" aria-label="Page">
            <a href="#how" className="hover:text-primary">How it works</a>
            <a href="#save" className="hover:text-primary">What you save</a>
            <a href="#safe" className="hover:text-primary">Is it safe?</a>
            <a href="#questions" className="hover:text-primary">Questions</a>
          </nav>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onWatch} className="hidden text-[15px] text-secondary hover:text-primary sm:inline">
              Watch it work
            </button>
            <button type="button" onClick={onStart} className="btn-primary h-10 whitespace-nowrap px-4 text-[15px]">
              Find a cab share
            </button>
          </div>
        </div>
      </header>

      {/* 1. What is this? */}
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
            {/* On phones the stat line sits right under the sentence; desktop shows it as the ticket */}
            <div className="ticket-card px-5 py-4 lg:hidden" data-demo="hero-stat">
              <div className="flex items-center justify-between text-[13px] text-on-paper/70">
                <span>Airport to Jayanagar</span>
                <span>est.</span>
              </div>
              <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-on-paper/70">
                  Alone <span className="whitespace-nowrap font-semibold text-on-paper line-through decoration-on-paper/40">{ex ? inr(ex.soloFare) : '…'}</span>
                </span>
                <span className="text-on-paper/70">
                  With 3 people, each <span className="whitespace-nowrap text-xl font-extrabold text-green-ink">{ex ? inr(ex.perPerson) : '…'}</span>
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button type="button" onClick={onStart} className="btn-primary h-14 px-8 text-[17px]" data-demo="hero-cta">
                Find a cab share <span aria-hidden="true">→</span>
              </button>
              <button type="button" onClick={onWatch} className="btn-secondary h-14 px-6 text-[17px]" data-demo="watch-demo">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" aria-hidden="true">
                  <path d="M8 5.5v13l10.5-6.5z" />
                </svg>
                Watch it work (75 seconds)
              </button>
            </div>
            <p className="text-[15px] text-secondary">No account. We don’t run the cabs or touch your money.</p>
          </div>

          {/* The stat line, as an interactive 3D ticket */}
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

      {/* 2. What's the problem? */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28 space-y-12">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-4">
            <Question>What’s the problem?</Question>
            <h2 className="text-4xl font-bold leading-[1.05] sm:text-5xl">11:45 pm. 12 passengers. 12 cabs. Same road.</h2>
            <p className="text-lg leading-relaxed text-secondary">
              Late flights land in waves. People off the same plane, going to the same part of town, each pay the full airport
              fare and take the same 40 km road alone.
            </p>
          </div>
          <div className="lg:col-span-8">
            <ConvergenceMap />
          </div>
        </div>

        {/* The Old Way vs The EcoRide Share Comparison */}
        <OldVsEcoRideComparison />
      </section>

      {/* 3. What does it look like? */}
      <section className="border-y border-ink-800 bg-ink-900/40">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28 space-y-14">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <div className="space-y-4">
              <Question>What does it look like?</Question>
              <h2 className="text-4xl font-bold leading-[1.05] sm:text-5xl">One screen, from the plane to the pickup point.</h2>
              <p className="text-lg leading-relaxed text-secondary">
                A map with one card on top. The card always says what’s happening, what happens next, and gives you one thing
                to tap.
              </p>
              <button type="button" className="link text-lg" onClick={onWatch}>
                Watch the full trip
              </button>
            </div>
            <PhoneMockup solo={ex?.soloFare ?? 1610} each={ex?.perPerson ?? 580} area="Jayanagar" />
          </div>

          {/* Real Bangalore co-travellers and route waypoints */}
          <StoryWaypoints />
        </div>
      </section>

      {/* 4. How does it work? */}
      <section id="how" className="mx-auto max-w-4xl scroll-mt-20 px-4 py-20 sm:px-6 lg:py-28">
        <Question>How does it work?</Question>
        <h2 className="mt-4 text-4xl font-bold leading-[1.05] sm:text-5xl">Four steps, all on your phone.</h2>
        <ol className="relative mt-12 space-y-10">
          <span className="absolute bottom-3 left-[19px] top-3 border-l-2 border-dashed border-amber/70" aria-hidden="true" />
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative flex gap-6">
              <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-amber bg-ink-950 font-cockpit text-sm font-bold text-amber">
                {i + 1}
              </span>
              <div className="pt-1.5">
                <h3 className="text-2xl font-bold">{s.title}</h3>
                <p className="mt-2 max-w-[56ch] text-lg leading-relaxed text-secondary">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* 5. What do I save? */}
      <section id="save" className="mx-auto max-w-7xl scroll-mt-20 px-4 pb-20 sm:px-6 lg:pb-28">
        <Question>What do I save?</Question>
        <h2 className="mt-4 mb-8 max-w-3xl text-4xl font-bold leading-[1.05] sm:text-5xl">
          The airport fees and the long road, split between you.
        </h2>
        <FareSplitCalculator config={config} />
      </section>

      {/* 6. Is it safe? */}
      <section id="safe" className="scroll-mt-20 border-y border-ink-800 bg-ink-900/40">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-20 sm:px-6 lg:grid-cols-12 lg:py-28">
          <div className="space-y-4 lg:col-span-5">
            <Question>Is it safe?</Question>
            <h2 className="text-4xl font-bold leading-[1.05] sm:text-5xl">Here’s exactly what we do, and nothing more.</h2>
          </div>
          <ul className="space-y-5 text-lg lg:col-span-7">
            {SAFETY.map((t) => (
              <li key={t} className="flex gap-4 border-b border-ink-800 pb-5">
                <Check />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 7. What difference does it make? */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
        <div className="flex flex-wrap items-center gap-3">
          <Question>What difference does it make?</Question>
          <DemoChip />
        </div>
        <h2 className="mt-4 max-w-3xl text-4xl font-bold leading-[1.05] sm:text-5xl">Fewer cabs on the airport road.</h2>
        <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
          {[
            { v: impact?.co2_saved_kg ?? 0, label: 'kg of CO2 avoided, est.', green: true, suffix: '' },
            { v: impact?.km_saved ?? 0, label: 'km of airport road not driven', green: false, suffix: '' },
            { v: impact?.cabs_avoided ?? 0, label: 'solo cabs avoided', green: false, suffix: '' },
            { v: impact?.avg_saving_pct ?? 0, label: 'average saving per person, est.', green: true, suffix: '%' },
          ].map((s) => (
            <div key={s.label} className="border-l-2 border-ink-800 pl-5">
              <div className={`text-5xl font-extrabold tracking-tight sm:text-6xl ${s.green ? 'text-green' : 'text-primary'}`}>
                <DigitRoll value={Math.round(s.v * 10) / 10} suffix={s.suffix} />
              </div>
              <div className="mt-2 text-secondary">{s.label}</div>
            </div>
          ))}
        </div>
        <p className="mt-8 text-secondary">
          These totals come from the demo travellers in this build, not real trips.{' '}
          <button type="button" className="link" onClick={() => navigate('/methodology')}>
            How we estimate
          </button>
        </p>
      </section>

      {/* 8. Questions */}
      <section id="questions" className="mx-auto max-w-4xl scroll-mt-20 px-4 pb-20 sm:px-6 lg:pb-28">
        <Question>Questions</Question>
        <h2 className="mt-4 text-4xl font-bold sm:text-5xl">What people ask first.</h2>
        <div className="mt-8 divide-y divide-ink-800 border-y border-ink-800">
          {FAQ.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-xl font-semibold">
                {f.q}
                <span className="text-2xl text-secondary transition-transform group-open:rotate-45" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-[64ch] text-lg leading-relaxed text-secondary">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* 9. Final CTA and footer */}
      <section className="border-t border-ink-800">
        <div className="relative mx-auto max-w-7xl overflow-hidden px-4 py-20 text-center sm:px-6">
          <div className="absolute inset-0 amber-glow pointer-events-none" />
          <h2 className="relative text-4xl font-bold sm:text-6xl">Landing soon?</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-lg text-secondary">Two questions, and we’ll find who’s heading your way.</p>
          <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button type="button" onClick={onStart} className="btn-primary h-14 px-8 text-[17px]">
              Find a cab share <span aria-hidden="true">→</span>
            </button>
            <button type="button" onClick={onWatch} className="btn-secondary h-14 px-6 text-[17px]">
              Watch it work
            </button>
          </div>
        </div>
      </section>

      <footer className="border-t border-ink-800 pb-28 md:pb-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-md space-y-2">
            <Logo />
            <p className="text-sm text-secondary">
              A free, account-free way to share airport cabs out of Kempegowda International Airport (BLR). We don’t run cabs,
              take commission or handle payments.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-3 text-[15px] text-secondary" aria-label="Footer">
            <button type="button" className="hover:text-primary" onClick={() => navigate('/trip')}>Find a cab share</button>
            <button type="button" className="hover:text-primary" onClick={() => navigate('/demo')}>Two-phone demo</button>
            <button type="button" className="hover:text-primary" onClick={() => navigate('/impact')}>Impact</button>
            <button type="button" className="hover:text-primary" onClick={() => navigate('/help')}>Help</button>
            <button type="button" className="hover:text-primary" onClick={() => navigate('/methodology')}>How we estimate</button>
            <button type="button" className="hover:text-primary" onClick={() => navigate('/admin')}>Operations</button>
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
        <button type="button" onClick={onStart} className="btn-primary h-14 w-full text-[17px]" tabIndex={pastHero ? 0 : -1}>
          Find a cab share <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
};
