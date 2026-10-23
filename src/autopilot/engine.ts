/**
 * src/autopilot/engine.ts — Runs the real UI by itself.
 *
 * A scenario is a list of plain-data steps: {id, caption, actor, action, waitMs}. For each action the
 * engine waits for the target ([data-demo="..."]), scrolls it into view, glides a visible cursor to it,
 * shows a ripple and dispatches a real click; text is typed one character at a time. Steps are
 * serialisable so the /demo director can send them to phone frames with postMessage.
 */
import { navigate } from '../router';
import { prefersReducedMotion } from '../utils';

export type AutopilotAction =
  | { type: 'navigate'; path: string }
  | { type: 'click'; target: string }
  | { type: 'type'; target: string; text: string; clear?: boolean }
  | { type: 'point'; target: string }
  | { type: 'waitFor'; target: string; timeoutMs?: number }
  | { type: 'scroll'; target: string }
  | { type: 'call'; name: string }
  | { type: 'pause'; ms: number };

export interface ScenarioStep {
  id: string;
  caption: string;
  actor: 'you' | 'demo' | 'system';
  action: AutopilotAction | AutopilotAction[];
  /** How long the caption stays up after the actions, at 1x. */
  waitMs: number;
}

export type Speed = 1 | 1.5 | 2;

export interface EngineState {
  status: 'idle' | 'playing' | 'paused' | 'done' | 'error';
  stepIndex: number;
  total: number;
  caption: string;
  actor: ScenarioStep['actor'];
  speed: Speed;
  loop: boolean;
  pausedByUser: boolean;
  error: string | null;
  scenario: string | null;
}

class Aborted extends Error {}

const CURSOR_MS = 600;
const TYPE_MS = 60;
const WAIT_TIMEOUT_MS = 20000;

function q(target: string): HTMLElement | null {
  const all = document.querySelectorAll<HTMLElement>(`[data-demo="${target}"]`);
  // The last match is the topmost (modals render after the page)
  for (let i = all.length - 1; i >= 0; i--) {
    if (all[i].getClientRects().length > 0) return all[i];
  }
  return null;
}

function usable(el: HTMLElement): boolean {
  return !(el as HTMLButtonElement).disabled && el.getAttribute('aria-disabled') !== 'true';
}

function setNativeValue(el: HTMLInputElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

// -----------------------------------------------------------------------------
// The visible cursor
// -----------------------------------------------------------------------------
class Cursor {
  private el: HTMLDivElement | null = null;
  private x = -40;
  private y = -40;

  private ensure(): HTMLDivElement {
    if (this.el && document.body.contains(this.el)) return this.el;
    const el = document.createElement('div');
    el.className = 'autopilot-cursor';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML =
      '<svg width="28" height="28" viewBox="0 0 28 28"><path d="M4 2.5 23 13.6l-8.4 1.9-4.3 8.2z" fill="#F3EFE6" stroke="#07090A" stroke-width="1.8" stroke-linejoin="round"/></svg>';
    el.style.transform = `translate(${this.x}px, ${this.y}px)`;
    document.body.appendChild(el);
    this.el = el;
    return el;
  }

  async moveTo(target: HTMLElement, ms: number): Promise<void> {
    const el = this.ensure();
    const r = target.getBoundingClientRect();
    this.x = r.left + Math.min(r.width / 2, Math.max(18, r.width * 0.3));
    this.y = r.top + r.height / 2;
    const dur = prefersReducedMotion() ? 0 : ms;
    el.style.transition = dur ? `transform ${dur}ms cubic-bezier(0.45, 0, 0.2, 1)` : 'none';
    el.style.opacity = '1';
    el.style.transform = `translate(${this.x}px, ${this.y}px)`;
    await new Promise((res) => setTimeout(res, dur));
  }

  ripple(): void {
    const r = document.createElement('span');
    r.className = 'autopilot-ripple';
    r.style.left = `${this.x}px`;
    r.style.top = `${this.y}px`;
    document.body.appendChild(r);
    setTimeout(() => r.remove(), 600);
  }

  hide(): void {
    if (this.el) this.el.style.opacity = '0';
  }

  remove(): void {
    this.el?.remove();
    this.el = null;
  }
}

// -----------------------------------------------------------------------------
// Engine
// -----------------------------------------------------------------------------
export class Autopilot {
  private steps: ScenarioStep[] = [];
  private listeners = new Set<() => void>();
  private runId = 0;
  private resumeWaiters: (() => void)[] = [];
  private cursor = new Cursor();
  commands: Record<string, () => Promise<unknown> | unknown> = {};
  onFinish?: (ok: boolean, error?: string) => void;

  state: EngineState = {
    status: 'idle',
    stepIndex: 0,
    total: 0,
    caption: '',
    actor: 'system',
    speed: 1,
    loop: false,
    pausedByUser: false,
    error: null,
    scenario: null,
  };

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getState = () => this.state;

  private set(patch: Partial<EngineState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  load(name: string, steps: ScenarioStep[]) {
    this.steps = steps;
    this.set({ scenario: name, total: steps.length, stepIndex: 0, caption: steps[0]?.caption ?? '', status: 'idle', error: null });
  }

  play(from = 0, fastUntil = -1) {
    const id = ++this.runId;
    this.set({ status: 'playing', pausedByUser: false, error: null });
    this.flushResume();
    this.run(id, from, fastUntil);
  }

  pause(byUser = false) {
    if (this.state.status !== 'playing') return;
    this.set({ status: 'paused', pausedByUser: byUser });
  }

  resume() {
    if (this.state.status !== 'paused') return;
    this.set({ status: 'playing', pausedByUser: false });
    this.flushResume();
  }

  restart() {
    this.play(0);
  }

  /** Jumping ahead replays the earlier steps instantly so the app is always in a valid state. */
  skipTo(index: number) {
    this.play(0, Math.max(0, Math.min(index, this.steps.length - 1)));
  }

  stop() {
    this.runId++;
    this.flushResume();
    this.cursor.remove();
    this.set({ status: 'idle', scenario: null, pausedByUser: false });
  }

  setSpeed(speed: Speed) {
    this.set({ speed });
  }

  setLoop(loop: boolean) {
    this.set({ loop });
  }

  private flushResume() {
    const w = this.resumeWaiters;
    this.resumeWaiters = [];
    w.forEach((f) => f());
  }

  private async checkpoint(id: number) {
    if (id !== this.runId) throw new Aborted();
    while (this.state.status === 'paused') {
      await new Promise<void>((res) => this.resumeWaiters.push(res));
      if (id !== this.runId) throw new Aborted();
    }
  }

  private async sleep(ms: number, id: number) {
    let left = ms;
    while (left > 0) {
      await this.checkpoint(id);
      const slice = Math.min(50, left);
      await new Promise((res) => setTimeout(res, slice));
      left -= slice;
    }
    await this.checkpoint(id);
  }

  private async find(target: string, id: number, timeoutMs = WAIT_TIMEOUT_MS, needUsable = true): Promise<HTMLElement> {
    const started = Date.now();
    for (;;) {
      await this.checkpoint(id);
      const el = q(target);
      if (el && (!needUsable || usable(el))) return el;
      if (Date.now() - started > timeoutMs) throw new Error(`The demo couldn't find “${target}”.`);
      await new Promise((res) => setTimeout(res, 100));
    }
  }

  private async exec(a: AutopilotAction, id: number, fast: boolean) {
    const speed = this.state.speed;
    const scaled = (ms: number) => (fast ? 0 : ms / speed);
    switch (a.type) {
      case 'navigate':
        navigate(a.path);
        await this.sleep(fast ? 50 : 350, id);
        return;
      case 'pause':
        await this.sleep(scaled(a.ms), id);
        return;
      case 'call': {
        await this.checkpoint(id);
        const fn = this.commands[a.name];
        if (!fn) throw new Error(`Unknown demo command ${a.name}`);
        await fn();
        return;
      }
      case 'waitFor':
        await this.find(a.target, id, a.timeoutMs, false);
        return;
      case 'scroll': {
        const el = await this.find(a.target, id, undefined, false);
        el.scrollIntoView({ block: 'center', behavior: fast || prefersReducedMotion() ? 'auto' : 'smooth' });
        await this.sleep(scaled(400), id);
        return;
      }
      case 'point': {
        const el = await this.find(a.target, id, undefined, false);
        el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
        await this.cursor.moveTo(el, scaled(CURSOR_MS));
        return;
      }
      case 'click': {
        const el = await this.find(a.target, id);
        el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
        await this.cursor.moveTo(el, scaled(CURSOR_MS));
        await this.checkpoint(id);
        if (!fast) this.cursor.ripple();
        el.click();
        await this.sleep(scaled(220), id);
        return;
      }
      case 'type': {
        const el = (await this.find(a.target, id)) as HTMLInputElement;
        el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
        await this.cursor.moveTo(el, scaled(CURSOR_MS));
        if (!fast) this.cursor.ripple();
        el.focus({ preventScroll: true });
        if (a.clear) setNativeValue(el, '');
        if (fast) {
          setNativeValue(el, (a.clear ? '' : el.value) + a.text);
          return;
        }
        for (const ch of a.text) {
          await this.checkpoint(id);
          setNativeValue(el, el.value + ch);
          await new Promise((res) => setTimeout(res, TYPE_MS / speed));
        }
        return;
      }
    }
  }

  private async run(id: number, from: number, fastUntil: number) {
    try {
      for (let i = from; i < this.steps.length; i++) {
        await this.checkpoint(id);
        const step = this.steps[i];
        const fast = i < fastUntil;
        this.set({ stepIndex: i, caption: step.caption, actor: step.actor });
        const actions = Array.isArray(step.action) ? step.action : [step.action];
        for (const a of actions) await this.exec(a, id, fast);
        await this.sleep(fast ? 0 : step.waitMs / this.state.speed, id);
      }
      if (id !== this.runId) return;
      this.cursor.hide();
      this.onFinish?.(true);
      if (this.state.loop) {
        this.play(0);
      } else {
        this.set({ status: 'done', caption: 'That’s the whole trip. Restart to watch again, or try it yourself.' });
      }
    } catch (e) {
      if (e instanceof Aborted) return;
      const msg = e instanceof Error ? e.message : String(e);
      this.cursor.hide();
      this.onFinish?.(false, msg);
      this.set({ status: 'error', error: msg, caption: `${msg} Restart the demo to try again.` });
    }
  }
}
