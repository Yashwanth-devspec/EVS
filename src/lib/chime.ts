/**
 * src/lib/chime.ts — Synthesized Airport Terminal Chime using Web Audio API.
 *
 * Zero external audio assets, zero latency, warm two-tone major third airport
 * chime (F4 -> A4) reminiscent of international terminal boarding announcements.
 */

class AirportAudioService {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {
    try {
      const stored = localStorage.getItem('ecoride_chime_enabled');
      this.enabled = stored !== 'false';
    } catch {
      this.enabled = true;
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(val: boolean): void {
    this.enabled = val;
    try {
      localStorage.setItem('ecoride_chime_enabled', val ? 'true' : 'false');
    } catch {
      // ignore
    }
  }

  public toggle(): boolean {
    this.setEnabled(!this.enabled);
    if (this.enabled) {
      this.playChime();
    }
    return this.enabled;
  }

  private initCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Two-tone airport gate announcement chime (F4 349.23 Hz -> A4 440.00 Hz)
   */
  public playChime(): void {
    if (!this.enabled) return;
    try {
      const ctx = this.initCtx();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Note 1: F4 (349.23 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(349.23, now);

      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.34);

      // Note 2: A4 (440.00 Hz) - major third higher, slightly louder & longer
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(440.0, now + 0.16);

      gain2.gain.setValueAtTime(0.001, now + 0.16);
      gain2.gain.exponentialRampToValueAtTime(0.22, now + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.0005, now + 0.65);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.16);
      osc2.stop(now + 0.68);
    } catch {
      // Audio context blocked or unsupported
    }
  }

  /**
   * Subtle soft click on tactile confirmation
   */
  public playClick(): void {
    if (!this.enabled) return;
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.045);
    } catch {
      // Ignore
    }
  }
}

export const chime = new AirportAudioService();
export const airportAudio = chime;
