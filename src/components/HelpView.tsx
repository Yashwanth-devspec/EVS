import React from 'react';
import { FAQ, SAFETY, STEPS } from '../content';
import { navigate } from '../router';
import { useAutopilot } from '../autopilot/AutopilotProvider';
import { IconPhone, IconShield, IconCheck } from '../trip/icons';

/** The Help tab: how it works, what keeps you safe, and the common questions. */
export const HelpView: React.FC = () => {
  const { start } = useAutopilot();
  return (
    <div className="mx-auto max-w-3xl space-y-14 px-4 py-8 sm:px-6">
      <section className="space-y-4">
        <h1 className="text-3xl font-bold sm:text-4xl">Help</h1>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <a href="tel:112" className="flex items-center gap-3 rounded-2xl border border-red/40 bg-red/10 p-4">
            <span className="text-red">
              <IconPhone size={24} />
            </span>
            <span>
              <span className="block font-semibold">Call 112</span>
              <span className="block text-sm text-secondary">India’s emergency number</span>
            </span>
          </a>
          <button type="button" onClick={() => start('main')} className="flex items-center gap-3 rounded-2xl border border-ink-800 bg-ink-900 p-4 text-left">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" aria-hidden="true" className="text-amber">
              <path d="M8 5.5v13l10.5-6.5z" />
            </svg>
            <span>
              <span className="block font-semibold">Watch a full trip</span>
              <span className="block text-sm text-secondary">75 seconds, with demo travellers</span>
            </span>
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold">How it works</h2>
        <ol className="relative mt-6 space-y-7">
          <span className="absolute bottom-3 left-[15px] top-3 border-l-2 border-dashed border-amber/70" aria-hidden="true" />
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative flex gap-5">
              <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-amber bg-ink-950 font-cockpit text-xs font-bold text-amber">
                {i + 1}
              </span>
              <div>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="text-secondary">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <IconShield size={24} /> Staying safe
        </h2>
        <ul className="mt-5 space-y-4">
          {SAFETY.map((t) => (
            <li key={t} className="flex gap-3">
              <span className="mt-0.5 text-green">
                <IconCheck />
              </span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-bold">Questions</h2>
        <div className="mt-4 divide-y divide-ink-800 border-y border-ink-800">
          {FAQ.map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
                {f.q}
                <span className="text-xl text-secondary transition-transform group-open:rotate-45" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="mt-2 text-secondary">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-ink-800 bg-ink-900 p-5">
        <h2 className="text-lg font-semibold">How the numbers are worked out</h2>
        <p className="mt-1 text-secondary">Fares, distances and CO2 are estimates. The method, the assumptions and what can go wrong are all written down.</p>
        <button type="button" className="link mt-3" onClick={() => navigate('/methodology')}>
          Read how we estimate
        </button>
      </section>
    </div>
  );
};
