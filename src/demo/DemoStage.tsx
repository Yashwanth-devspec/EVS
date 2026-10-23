import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { ScenarioStep, Speed } from '../autopilot/engine';
import { Logo, DemoChip } from '../components/Header';
import { searchParam, navigate } from '../router';

type Phone = 'a' | 'b';

interface DirectorStep {
  caption: string;
  reset?: boolean;
  runs: { phone: Phone; steps: ScenarioStep[] }[];
  holdMs?: number;
}

const s = (id: string, action: ScenarioStep['action'], waitMs = 0, actor: ScenarioStep['actor'] = 'you'): ScenarioStep => ({
  id,
  caption: '',
  actor,
  action,
  waitMs,
});

const pickJayanagar: ScenarioStep[] = [
  s('where', [{ type: 'type', target: 'where-input', text: 'Jayanagar' }, { type: 'click', target: 'where-result-0' }], 400),
  s('when', { type: 'click', target: 'land-chip-1' }, 400),
  s('find', { type: 'click', target: 'find-people' }, 200),
];

/** The director script. Phone A is Asha (you); phone B is a second traveller, Deepa. */
export const STAGE_SCRIPT: DirectorStep[] = [
  {
    caption: 'Two travellers, two phones. Both land at Bengaluru airport at about the same time.',
    reset: true,
    runs: [
      { phone: 'a', steps: [s('open', [{ type: 'navigate', path: '/trip' }, { type: 'call', name: 'refresh' }, { type: 'waitFor', target: 'where-input' }])] },
      { phone: 'b', steps: [s('open', [{ type: 'navigate', path: '/trip' }, { type: 'call', name: 'refresh' }, { type: 'waitFor', target: 'where-input' }])] },
    ],
    holdMs: 2500,
  },
  {
    caption: 'Deepa is going to Jayanagar. Nobody is heading her way yet, so EcoRide keeps looking.',
    runs: [{ phone: 'b', steps: [...pickJayanagar, s('wait', { type: 'waitFor', target: 'trip-no-match' }, 2000)] }],
  },
  {
    caption: 'Asha lands at the same time and is going the same way. Deepa comes up as her best match.',
    runs: [{ phone: 'a', steps: [...pickJayanagar, s('best', [{ type: 'waitFor', target: 'best-match' }, { type: 'point', target: 'best-match' }], 2500)] }],
  },
  {
    caption: 'Asha taps Share this cab and gives only her first name.',
    runs: [
      {
        phone: 'a',
        steps: [
          s('share', [
            { type: 'click', target: 'share-cab' },
            { type: 'type', target: 'name-input', text: 'Asha' },
            { type: 'click', target: 'name-confirm' },
            { type: 'waitFor', target: 'trip-invite-sent' },
          ], 800),
        ],
      },
    ],
  },
  {
    caption: 'Deepa’s phone shows the invite and why it’s a match. She accepts.',
    runs: [
      {
        phone: 'b',
        steps: [
          s('accept', [
            { type: 'waitFor', target: 'accept-invite' },
            { type: 'pause', ms: 2200 },
            { type: 'click', target: 'accept-invite' },
            { type: 'type', target: 'name-input', text: 'Deepa' },
            { type: 'click', target: 'name-confirm' },
            { type: 'waitFor', target: 'trip-confirmed' },
          ], 600),
        ],
      },
      { phone: 'a', steps: [s('wait', { type: 'waitFor', target: 'trip-confirmed', timeoutMs: 30000 }, 600)] },
    ],
    holdMs: 1800,
  },
  {
    caption: 'Skip ahead to landing. Each of them taps I’ve landed.',
    runs: [
      { phone: 'a', steps: [s('land', [{ type: 'call', name: 'advanceToLanding' }, { type: 'click', target: 'landed' }, { type: 'waitFor', target: 'trip-landed' }], 1200)] },
      { phone: 'b', steps: [s('land', [{ type: 'pause', ms: 1200 }, { type: 'click', target: 'landed' }, { type: 'waitFor', target: 'trip-landed' }], 1200)] },
    ],
  },
  {
    caption: 'They meet at the pickup point and check they have the same 4-digit code.',
    runs: [
      { phone: 'a', steps: [s('pickup', [{ type: 'click', target: 'at-pickup' }, { type: 'waitFor', target: 'trip-at-pickup' }], 1500)] },
      { phone: 'b', steps: [s('pickup', [{ type: 'click', target: 'at-pickup' }, { type: 'waitFor', target: 'trip-at-pickup' }], 1500)] },
    ],
  },
  {
    caption: 'Asha books one cab in Uber and adds the number plate. Deepa sees it straight away.',
    runs: [
      {
        phone: 'a',
        steps: [
          s('book', [
            { type: 'click', target: 'open-uber' },
            { type: 'waitFor', target: 'handoff' },
            { type: 'pause', ms: 2000 },
            { type: 'click', target: 'handoff-close' },
            { type: 'type', target: 'cab-input', text: 'KA 01 AB 1234' },
            { type: 'click', target: 'cab-save' },
            { type: 'waitFor', target: 'trip-cab-booked' },
          ], 800),
        ],
      },
      { phone: 'b', steps: [s('see-cab', { type: 'waitFor', target: 'trip-cab-booked', timeoutMs: 40000 }, 1500)] },
    ],
  },
  {
    caption: 'After the ride, Asha enters what the app charged. Deepa’s share and a UPI link appear.',
    runs: [
      {
        phone: 'a',
        steps: [
          s('settle', [
            { type: 'click', target: 'settle-up' },
            { type: 'type', target: 'upi-input', text: 'asha@okaxis' },
            { type: 'click', target: 'split-fare' },
            { type: 'waitFor', target: 'finish' },
          ], 1000),
        ],
      },
      { phone: 'b', steps: [s('see-share', { type: 'waitFor', target: 'paid', timeoutMs: 40000 }, 1500)] },
    ],
  },
  {
    caption: 'Deepa pays her share by UPI. Both see what they saved.',
    runs: [
      { phone: 'b', steps: [s('paid', [{ type: 'click', target: 'paid' }, { type: 'waitFor', target: 'trip-done' }], 2500)] },
      { phone: 'a', steps: [s('finish', [{ type: 'pause', ms: 1200 }, { type: 'click', target: 'finish' }, { type: 'waitFor', target: 'trip-done' }], 2500)] },
    ],
    holdMs: 3000,
  },
];

const PHONE_W = 390;
const PHONE_H = 844;

function randomSid(phone: Phone) {
  return `sess_stage_${phone}_${Math.random().toString(36).slice(2, 10)}`;
}

export const DemoStage: React.FC = () => {
  const autoplay = searchParam('autoplay') === '1';
  const [loop, setLoop] = useState(searchParam('loop') === '1');
  const [speed, setSpeed] = useState<Speed>(1);
  const [status, setStatus] = useState<'idle' | 'playing' | 'paused' | 'done' | 'error'>('idle');
  const [stepIndex, setStepIndex] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [scale, setScale] = useState(0.6);
  const [sids] = useState(() => ({ a: randomSid('a'), b: randomSid('b') }));
  const frames = useRef<Record<Phone, HTMLIFrameElement | null>>({ a: null, b: null });
  const ready = useRef<Record<Phone, boolean>>({ a: false, b: false });
  const pending = useRef(new Map<string, (ok: boolean, err?: string) => void>());
  const generation = useRef(0);
  const paused = useRef(false);
  const resumeWaiters = useRef<(() => void)[]>([]);
  const loopRef = useRef(loop);
  const speedRef = useRef(speed);
  loopRef.current = loop;
  speedRef.current = speed;

  // Fit two phones side by side on any screen
  useEffect(() => {
    const fit = () => {
      const availH = window.innerHeight - 230;
      const availW = window.innerWidth - 48;
      setScale(Math.max(0.3, Math.min(1, availH / PHONE_H, (availW / 2 - 24) / PHONE_W)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const post = (phone: Phone, msg: Record<string, unknown>) =>
    frames.current[phone]?.contentWindow?.postMessage({ source: 'ecoride-director', ...msg }, window.location.origin);
  const broadcast = (msg: Record<string, unknown>) => (['a', 'b'] as Phone[]).forEach((p) => post(p, msg));

  const pause = useCallback((byUser: boolean) => {
    paused.current = true;
    setStatus('paused');
    setNote(byUser ? 'Paused because you touched the screen. Resume when you’re ready.' : null);
    broadcast({ type: 'pause' });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resume = () => {
    paused.current = false;
    setStatus('playing');
    setNote(null);
    broadcast({ type: 'resume' });
    const w = resumeWaiters.current;
    resumeWaiters.current = [];
    w.forEach((f) => f());
  };

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.source !== 'ecoride-frame') return;
      const phone = (['a', 'b'] as Phone[]).find((p) => frames.current[p]?.contentWindow === e.source);
      if (!phone) return;
      if (e.data.type === 'ready') ready.current[phone] = true;
      if (e.data.type === 'interrupted') pause(true);
      if (e.data.type === 'done') {
        const fn = pending.current.get(e.data.runId);
        pending.current.delete(e.data.runId);
        fn?.(e.data.ok, e.data.error);
      }
    };
    window.addEventListener('message', onMsg);
    const onUser = (e: Event) => {
      if (e.isTrusted && !(e.target as HTMLElement)?.closest?.('[data-autopilot-ui]') && !paused.current && generation.current > 0) pause(true);
    };
    window.addEventListener('pointerdown', onUser, true);
    window.addEventListener('keydown', onUser, true);
    return () => {
      window.removeEventListener('message', onMsg);
      window.removeEventListener('pointerdown', onUser, true);
      window.removeEventListener('keydown', onUser, true);
    };
  }, [pause]);

  const runOn = (phone: Phone, steps: ScenarioStep[]) =>
    new Promise<void>((resolve, reject) => {
      const runId = `${phone}-${Math.random().toString(36).slice(2)}`;
      pending.current.set(runId, (ok, err) => (ok ? resolve() : reject(new Error(err || 'A phone got stuck.'))));
      post(phone, { type: 'run', runId, steps, speed: speedRef.current, name: 'stage' });
    });

  const play = useCallback(async () => {
    const gen = ++generation.current;
    paused.current = false;
    setStatus('playing');
    setNote(null);
    broadcast({ type: 'stop' });
    const alive = () => gen === generation.current;
    const gate = async () => {
      while (paused.current && alive()) await new Promise<void>((r) => resumeWaiters.current.push(r));
    };
    const wait = async (ms: number) => {
      let left = ms;
      while (left > 0 && alive()) {
        await gate();
        await new Promise((r) => setTimeout(r, 50));
        left -= 50;
      }
    };
    try {
      const started = Date.now();
      while (!(ready.current.a && ready.current.b)) {
        if (Date.now() - started > 15000) throw new Error('The phones didn’t load.');
        await new Promise((r) => setTimeout(r, 100));
      }
      do {
        for (let i = 0; i < STAGE_SCRIPT.length; i++) {
          if (!alive()) return;
          await gate();
          const step = STAGE_SCRIPT[i];
          setStepIndex(i);
          if (step.reset) await api.demoReset('stage');
          await Promise.all(step.runs.map((r) => runOn(r.phone, r.steps)));
          await wait((step.holdMs ?? 1200) / speedRef.current);
        }
      } while (loopRef.current && alive());
      if (alive()) setStatus('done');
    } catch (e) {
      if (!alive()) return;
      setStatus('error');
      setNote(e instanceof Error ? `${e.message} Restart to try again.` : 'Something went wrong. Restart to try again.');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (autoplay) play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = STAGE_SCRIPT[stepIndex];
  const frameSrc = (p: Phone) => `/trip?sid=${sids[p]}&embed=1`;

  return (
    <div className="min-h-screen bg-ink-950 text-primary">
      <header className="flex h-14 items-center justify-between border-b border-ink-800 px-4">
        <Logo onClick={() => navigate('/')} />
        <DemoChip />
      </header>

      <div className="mx-auto max-w-5xl px-4 pt-4" data-autopilot-ui>
        <div className="rounded-2xl border border-ink-700 bg-ink-900 p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-secondary">
            <span className="tabular-nums" data-demo="stage-step">
              Step {stepIndex + 1} of {STAGE_SCRIPT.length}
            </span>
            <DemoChip />
          </div>
          <p className="mt-1 text-[15px] leading-snug" aria-live="polite" data-demo="stage-caption">
            {note ?? (status === 'idle' ? 'Press Play to watch two travellers share a cab, start to finish.' : status === 'done' ? 'That’s the whole trip, seen from both phones.' : step.caption)}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {status === 'playing' ? (
              <button type="button" className="ap-btn ap-btn-main" onClick={() => pause(false)}>
                Pause
              </button>
            ) : status === 'paused' ? (
              <button type="button" className="ap-btn ap-btn-main" onClick={resume}>
                Resume
              </button>
            ) : (
              <button type="button" className="ap-btn ap-btn-main" onClick={play} data-demo="stage-play">
                Play
              </button>
            )}
            <button type="button" className="ap-btn" onClick={play}>
              Restart
            </button>
            <div className="flex rounded-full border border-ink-700 p-0.5" role="radiogroup" aria-label="Speed">
              {([1, 1.5, 2] as Speed[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={speed === v}
                  onClick={() => {
                    setSpeed(v);
                    broadcast({ type: 'speed', speed: v });
                  }}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${speed === v ? 'bg-paper text-ink-950' : 'text-secondary'}`}
                >
                  {v}x
                </button>
              ))}
            </div>
            <label className="ap-btn cursor-pointer">
              <input type="checkbox" className="accent-amber" checked={loop} onChange={(e) => setLoop(e.target.checked)} /> Loop
            </label>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-5xl items-start justify-center gap-6 px-4 py-5">
        {(['a', 'b'] as Phone[]).map((p) => (
          <figure key={p} className="flex flex-col items-center gap-2">
            <div
              className="overflow-hidden rounded-[36px] border-[6px] border-ink-700 bg-ink-950 shadow-2xl"
              style={{ width: PHONE_W * scale + 12, height: PHONE_H * scale + 12 }}
            >
              <iframe
                ref={(el) => (frames.current[p] = el)}
                title={p === 'a' ? 'Asha’s phone' : 'Deepa’s phone'}
                src={frameSrc(p)}
                style={{ width: PHONE_W, height: PHONE_H, transform: `scale(${scale})`, transformOrigin: '0 0', border: 0 }}
              />
            </div>
            <figcaption className="text-sm text-secondary">
              {p === 'a' ? 'Asha (you)' : <>Deepa <span className="demo-tag">Demo traveller</span></>}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
};
