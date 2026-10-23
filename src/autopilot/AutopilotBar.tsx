import React from 'react';
import { useAutopilot } from './AutopilotProvider';
import { Speed } from './engine';

const SPEEDS: Speed[] = [1, 1.5, 2];

/** Captions ("Step n of N" plus one plain sentence) and the demo controls. */
export const AutopilotBar: React.FC = () => {
  const { engine, state } = useAutopilot();
  if (!state.scenario) return null;
  const playing = state.status === 'playing';
  const actor = state.actor === 'demo' ? 'Demo traveller' : state.actor === 'you' ? 'You' : null;

  return (
    <div
      className="fixed left-2 right-2 top-[64px] z-[1250] mx-auto max-w-2xl rounded-2xl border border-ink-700 bg-ink-950/95 p-3 shadow-2xl backdrop-blur"
      data-autopilot-ui
      role="region"
      aria-label="Demo walkthrough"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2 text-xs text-secondary">
            <span className="tabular-nums" data-demo="autopilot-step">
              Step {Math.min(state.stepIndex + 1, state.total)} of {state.total}
            </span>
            {actor && <span className={actor === 'Demo traveller' ? 'demo-tag' : 'badge'}>{actor}</span>}
            <span className="demo-chip">Demo data</span>
          </div>
          <p className="mt-1 text-[15px] leading-snug text-primary" data-demo="autopilot-caption">
            {state.pausedByUser ? 'Paused because you touched the screen. Have a look around, then resume.' : state.caption}
          </p>
        </div>
        <button type="button" className="btn-quiet shrink-0 px-2" onClick={() => engine.stop()} aria-label="Close the demo">
          Close
        </button>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {state.status === 'done' || state.status === 'error' ? (
          <button type="button" className="ap-btn ap-btn-main" onClick={() => engine.restart()}>
            Watch again
          </button>
        ) : (
          <button
            type="button"
            className="ap-btn ap-btn-main"
            onClick={() => (playing ? engine.pause(false) : engine.resume())}
            data-demo="autopilot-toggle"
          >
            {playing ? 'Pause' : 'Resume'}
          </button>
        )}
        <button type="button" className="ap-btn" onClick={() => engine.restart()}>
          Restart
        </button>
        <div className="flex rounded-full border border-ink-700 p-0.5" role="radiogroup" aria-label="Speed">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={state.speed === s}
              onClick={() => engine.setSpeed(s)}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${state.speed === s ? 'bg-paper text-ink-950' : 'text-secondary'}`}
            >
              {s}x
            </button>
          ))}
        </div>
        <label className="ap-btn cursor-pointer">
          <input type="checkbox" className="accent-amber" checked={state.loop} onChange={(e) => engine.setLoop(e.target.checked)} /> Loop
        </label>
        <select
          className="ap-btn bg-ink-950"
          value=""
          onChange={(e) => e.target.value && engine.skipTo(Number(e.target.value))}
          aria-label="Skip to step"
        >
          <option value="">Skip to step…</option>
          {Array.from({ length: state.total }, (_, i) => (
            <option key={i} value={i}>
              Step {i + 1}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
