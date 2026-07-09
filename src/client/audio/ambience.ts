/**
 * The sound of the night, synthesised.
 *
 * Nothing here is a file. A low pad, a breath of air and a few bell tones are
 * built out of oscillators and a noise buffer at runtime, which means TaaraNight
 * ships no licensed audio (Devvit Rules: original or licensed assets only) and
 * costs a player on mobile data nothing at all to hear.
 *
 * Browsers refuse to make a sound before the player has touched the page, so the
 * `AudioContext` is not created until `unlock()` is called from a real gesture.
 * Every method is safe to call before that, and on a browser with no Web Audio
 * at all: the game simply stays quiet.
 *
 * Volumes are deliberately low. This is meant to sit under a bedtime, not to be
 * noticed.
 */

import { mulberry32 } from '../../shared/rng';
import { prefs } from '../ui/prefs';

/** A soft, unresolved scale — nothing in it ever sounds like an answer. */
const PENTATONIC = [0, 3, 5, 7, 10, 12];
const ROOT_HZ = 261.63; // middle C

const PAD_GAIN = 0.05;
const AIR_GAIN = 0.012;
const CHIME_GAIN = 0.09;
const FADE_S = 0.6;

function semitone(root: number, steps: number): number {
  return root * Math.pow(2, steps / 12);
}

export class Ambience {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled: boolean;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  /**
   * Called from the player's first touch. Before a gesture an `AudioContext` is
   * born suspended and any sound scheduled on it is lost, so this is where the
   * night starts breathing.
   */
  unlock(): void {
    if (!this.enabled) return;
    const ctx = this.context();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  }

  /** The mute toggle. Turning sound on for the first time also starts the bed. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) {
      this.unlock();
      this.fadeMaster(1);
    } else {
      this.fadeMaster(0);
    }
  }

  /**
   * One bell, a step up the scale for each thread the player draws. Rising
   * pitch is the whole reward loop of the puzzle in a single sound.
   */
  chime(step: number): void {
    const ctx = this.live();
    if (!ctx) return;

    const note = PENTATONIC[step % PENTATONIC.length]!;
    const octave = Math.floor(step / PENTATONIC.length);
    this.bell(semitone(ROOT_HZ, note + octave * 12), CHIME_GAIN, 1.4);
  }

  /** The constellation completes: a slow arpeggio, warmer than the chimes. */
  reveal(): void {
    const ctx = this.live();
    if (!ctx) return;

    const now = ctx.currentTime;
    [0, 7, 12, 19].forEach((note, i) => {
      this.bell(semitone(ROOT_HZ, note), CHIME_GAIN * 0.9, 2.6, now + i * 0.16);
    });
  }

  /* ---------------------------------------------------------------- *
   *  Plumbing
   * ---------------------------------------------------------------- */

  /** The context, once the player has allowed one. Null when sound is off. */
  private live(): AudioContext | null {
    if (!this.enabled) return null;
    return this.ctx;
  }

  /** Build the context and the ambient bed, once. */
  private context(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return null;

    const ctx = new AudioContext();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? 1 : 0;
    this.master.connect(ctx.destination);

    this.buildPad(ctx, this.master);
    this.buildAir(ctx, this.master);

    return ctx;
  }

  /** Two quiet sines a fifth apart, breathing under everything else. */
  private buildPad(ctx: AudioContext, out: GainNode): void {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;

    const gain = ctx.createGain();
    gain.gain.value = PAD_GAIN;
    filter.connect(gain).connect(out);

    for (const [hz, detune] of [
      [ROOT_HZ / 2, -4],
      [semitone(ROOT_HZ / 2, 7), 5],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = hz;
      osc.detune.value = detune;
      osc.connect(filter);
      osc.start();
    }

    // A very slow swell, so the pad never sits perfectly still.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const depth = ctx.createGain();
    depth.gain.value = PAD_GAIN * 0.45;
    lfo.connect(depth).connect(gain.gain);
    lfo.start();
  }

  /** A band of filtered noise: the sound of a room with a window open. */
  private buildAir(ctx: AudioContext, out: GainNode): void {
    const seconds = 4;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    // Seeded rather than `Math.random`, so every night's air is the same air.
    const rng = mulberry32(0x7aa2);
    for (let i = 0; i < samples.length; i++) samples[i] = rng() * 2 - 1;

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 760;
    filter.Q.value = 0.7;

    const gain = ctx.createGain();
    gain.gain.value = AIR_GAIN;

    noise.connect(filter).connect(gain).connect(out);
    noise.start();
  }

  /** A struck sine with a long tail, plus a whisper of its own octave. */
  private bell(hz: number, peak: number, seconds: number, at?: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    const start = at ?? ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    gain.connect(master);

    for (const [multiple, level] of [
      [1, 1],
      [2, 0.25],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = hz * multiple;

      const partial = ctx.createGain();
      partial.gain.value = level;

      osc.connect(partial).connect(gain);
      osc.start(start);
      osc.stop(start + seconds + 0.05);
      osc.onended = () => osc.disconnect();
    }

    window.setTimeout(() => gain.disconnect(), (start - ctx.currentTime + seconds + 0.2) * 1000);
  }

  private fadeMaster(to: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(to, now + FADE_S);
  }
}

/** The one night the whole game listens to. */
export const ambience = new Ambience(prefs.sound);

/** Flip the sound preference and the sound itself together. */
export function setSound(on: boolean): void {
  prefs.set({ sound: on });
  ambience.setEnabled(on);
}
