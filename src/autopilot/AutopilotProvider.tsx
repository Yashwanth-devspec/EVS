import React, { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { Autopilot, EngineState, ScenarioStep, Speed } from './engine';
import { demoCommands, MAIN_SCENARIO } from './scenario';

interface AutopilotCtx {
  engine: Autopilot;
  state: EngineState;
  start: (name?: 'main') => void;
}

const Ctx = createContext<AutopilotCtx | null>(null);

export function useAutopilot(): AutopilotCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAutopilot outside AutopilotProvider');
  return c;
}

const SCENARIOS: Record<string, ScenarioStep[]> = { main: MAIN_SCENARIO };

/** Holds one engine for the whole app so a demo keeps running across page changes. */
export const AutopilotProvider: React.FC<{ children: React.ReactNode; embedded?: boolean }> = ({ children, embedded }) => {
  const engine = useMemo(() => {
    const e = new Autopilot();
    e.commands = demoCommands;
    return e;
  }, []);
  const state = useSyncExternalStore(engine.subscribe, engine.getState);

  // A real tap or key press pauses the demo and offers Resume.
  useEffect(() => {
    const onUser = (e: Event) => {
      if (!e.isTrusted) return;
      if ((e.target as HTMLElement | null)?.closest?.('[data-autopilot-ui]')) return;
      if (engine.state.status === 'playing') {
        engine.pause(true);
        if (embedded) window.parent?.postMessage({ source: 'ecoride-frame', type: 'interrupted' }, window.location.origin);
      }
    };
    window.addEventListener('pointerdown', onUser, true);
    window.addEventListener('keydown', onUser, true);
    return () => {
      window.removeEventListener('pointerdown', onUser, true);
      window.removeEventListener('keydown', onUser, true);
    };
  }, [engine, embedded]);

  // Inside a /demo phone frame, the director sends steps over postMessage.
  useEffect(() => {
    if (!embedded) return;
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.source !== 'ecoride-director') return;
      const { type } = e.data;
      if (type === 'run') {
        engine.load(e.data.name ?? 'stage', e.data.steps as ScenarioStep[]);
        engine.setSpeed((e.data.speed ?? 1) as Speed);
        engine.onFinish = (ok, error) =>
          window.parent?.postMessage({ source: 'ecoride-frame', type: 'done', runId: e.data.runId, ok, error }, window.location.origin);
        engine.play(0);
      } else if (type === 'pause') engine.pause(false);
      else if (type === 'resume') engine.resume();
      else if (type === 'speed') engine.setSpeed(e.data.speed as Speed);
      else if (type === 'stop') engine.stop();
    };
    window.addEventListener('message', onMsg);
    window.parent?.postMessage({ source: 'ecoride-frame', type: 'ready' }, window.location.origin);
    return () => window.removeEventListener('message', onMsg);
  }, [engine, embedded]);

  const start = (name: 'main' = 'main') => {
    engine.load(name, SCENARIOS[name]);
    engine.play(0);
  };

  return <Ctx.Provider value={{ engine, state, start }}>{children}</Ctx.Provider>;
};
