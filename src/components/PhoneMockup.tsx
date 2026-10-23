import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { prefersReducedMotion } from '../utils';
import { Stamp } from './primitives/Stamp';

interface Scene {
  caption: string;
  status: string;
  next: string;
  body: React.ReactNode;
  button: string;
  route: 'none' | 'preview' | 'shared' | 'pickup';
}

const rs = (n: number) => `Rs ${new Intl.NumberFormat('en-IN').format(Math.round(n / 10) * 10)}`;

/** The map behind the sheet, drawn as a simple schematic. */
const MiniMap: React.FC<{ route: Scene['route'] }> = ({ route }) => (
  <svg viewBox="0 0 300 330" className="absolute inset-0 h-full w-full" aria-hidden="true">
    <rect width="300" height="330" fill="#0B0F10" />
    {[40, 90, 140, 190, 240, 290].map((y) => (
      <path key={y} d={`M0 ${y} L300 ${y - 30}`} stroke="#14181A" strokeWidth="1" />
    ))}
    {[50, 120, 190, 260].map((x) => (
      <path key={x} d={`M${x} 0 L${x - 40} 330`} stroke="#14181A" strokeWidth="1" />
    ))}
    <path d="M230 40 C 200 90, 150 120, 120 170 S 90 230, 100 260" stroke="#1E2426" strokeWidth="10" fill="none" strokeLinecap="round" />
    {route !== 'none' && (
      <path
        d="M230 40 C 200 90, 150 120, 120 170 S 90 230, 100 260"
        stroke={route === 'preview' ? '#FFB020' : '#3DDC97'}
        strokeWidth="3.5"
        strokeDasharray={route === 'preview' ? '6 7' : undefined}
        fill="none"
        strokeLinecap="round"
      />
    )}
    <circle cx="230" cy="40" r="9" fill="#F3EFE6" stroke="#FFB020" strokeWidth="2" />
    <text x="244" y="45" fill="#ECEFEA" fontSize="12" fontWeight="600">BLR</text>
    {route !== 'none' && route !== 'pickup' && (
      <>
        <circle cx="120" cy="170" r="7" fill="#3DDC97" stroke="#07090A" strokeWidth="2" />
        <circle cx="100" cy="260" r="7" fill="#FFB020" stroke="#07090A" strokeWidth="2" />
      </>
    )}
    {route === 'pickup' && (
      <>
        <rect x="214" y="58" width="22" height="22" rx="6" fill="#FFB020" stroke="#07090A" strokeWidth="2" />
        <text x="221" y="74" fill="#07090A" fontSize="12" fontWeight="700">P</text>
      </>
    )}
  </svg>
);

export const PhoneMockup: React.FC<{ solo: number; each: number; area: string }> = ({ solo, each, area }) => {
  const scenes: Scene[] = [
    {
      caption: 'Tell it where you’re going and when you land.',
      status: 'Share a cab from the airport',
      next: 'Where are you going, and when do you land?',
      route: 'preview',
      button: 'Find people',
      body: (
        <div className="space-y-2">
          <div className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-[12px] text-primary">{area} 4th Block</div>
          <div className="flex gap-1.5">
            {['11:30 pm', '11:45 pm', '12:00 am'].map((t, i) => (
              <span key={t} className={`rounded-full border px-2 py-1 text-[11px] ${i === 1 ? 'border-paper bg-paper text-ink-950' : 'border-ink-700 text-secondary'}`}>
                {t}
              </span>
            ))}
          </div>
        </div>
      ),
    },
    {
      caption: 'The best match comes first, with what you’d save.',
      status: `Found 3 cab shares. The best saves you ${rs(solo - each)}.`,
      next: 'Pick one and we’ll ask the others.',
      route: 'preview',
      button: 'Share this cab',
      body: (
        <div className="rounded-xl border-2 border-amber bg-ink-900 p-2.5">
          <div className="text-[11px] text-amber">Best match</div>
          <div className="text-[22px] font-extrabold leading-tight text-green">Save {rs(solo - each)}</div>
          <div className="text-[11px] text-secondary">Kavya · {area} · Arjun · JP Nagar</div>
        </div>
      ),
    },
    {
      caption: 'Everyone says yes. Same 4-digit code for the whole group.',
      status: 'You’re sharing with Kavya and Arjun',
      next: 'When you land, tap I’ve landed.',
      route: 'shared',
      button: 'I’ve landed',
      body: (
        <div className="flex items-center justify-between rounded-xl bg-paper p-2.5 text-on-paper">
          <div>
            <div className="text-[10px] opacity-70">Pickup code</div>
            <div className="font-cockpit text-[24px] font-bold tracking-widest">4821</div>
          </div>
          <Stamp label="Confirmed" className="!text-[10px] !px-2" />
        </div>
      ),
    },
    {
      caption: 'Meet at pickup. One person books; everyone splits by UPI.',
      status: 'Your cab is KA 01 AB 1234',
      next: 'After the ride, split the real fare by UPI.',
      route: 'pickup',
      button: 'Settle up',
      body: (
        <div className="mx-auto w-fit rounded-lg border-2 border-on-paper bg-paper px-3 py-1.5">
          <span className="font-cockpit text-[16px] font-bold tracking-[0.12em] text-on-paper">KA 01 AB 1234</span>
        </div>
      ),
    },
  ];

  const [i, setI] = useState(0);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const reduced = prefersReducedMotion();

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.3 });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || reduced) return;
    const t = window.setInterval(() => setI((n) => (n + 1) % scenes.length), 3400);
    return () => window.clearInterval(t);
  }, [visible, reduced, scenes.length]);

  const scene = scenes[i];
  return (
    <div ref={ref} className="flex flex-col items-center gap-4">
      <div
        className="relative h-[520px] w-[260px] overflow-hidden rounded-[40px] border-[7px] border-ink-700 bg-ink-950 shadow-2xl"
        role="img"
        aria-label={`App preview, screen ${i + 1} of ${scenes.length}: ${scene.caption}`}
      >
        <div className="absolute inset-x-0 top-0 z-10 flex h-9 items-center justify-between bg-ink-950/90 px-4 text-[11px] text-secondary">
          <span className="font-semibold text-primary">EcoRide</span>
          <span className="rounded-full border border-amber/50 px-1.5 text-[9px] text-amber">Demo data</span>
        </div>
        <div className="absolute inset-x-0 top-9 h-[330px]">
          <MiniMap route={scene.route} />
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={i}
            className="absolute inset-x-0 bottom-0 z-10 rounded-t-[22px] border-t border-ink-700 bg-ink-950 px-4 pb-4 pt-2"
            initial={reduced ? false : { y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduced ? undefined : { y: 12, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-ink-700" />
            <p className="text-[13px] font-bold leading-snug text-primary">{scene.status}</p>
            <p className="mb-2.5 text-[11px] leading-snug text-secondary">{scene.next}</p>
            {scene.body}
            <div className="mt-3 rounded-full bg-paper py-2 text-center text-[12px] font-bold text-ink-950">{scene.button}</div>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="flex items-center gap-3" aria-live="polite">
        <div className="flex gap-1.5" role="tablist" aria-label="Preview screens">
          {scenes.map((_, n) => (
            <button
              key={n}
              type="button"
              role="tab"
              aria-selected={n === i}
              aria-label={`Screen ${n + 1}`}
              onClick={() => setI(n)}
              className={`h-2 rounded-full transition-all ${n === i ? 'w-6 bg-amber' : 'w-2 bg-ink-700'}`}
            />
          ))}
        </div>
        <p className="text-sm text-secondary">{scene.caption}</p>
      </div>
    </div>
  );
};
