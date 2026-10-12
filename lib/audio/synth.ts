/**
 * Placeholder voice: warm synth tones, one per clip id.
 * Each word gets a stable pitch from its hash so it always sounds the same
 * (like a consistent character voice). Swapped for real TTS files later
 * without changing callers — see lib/audio/engine.ts.
 */

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Base frequency for an id: warm kid-voice-ish range 300–520 Hz. */
export function voiceFreq(id: string): number {
  return 300 + (hashString(id) % 220);
}

export type ToneStep = { freq: number; at: number; dur: number; type?: OscillatorType; gain?: number };

function tone(
  ctx: BaseAudioContext,
  dest: AudioNode,
  freq: number,
  at: number,
  dur: number,
  type: OscillatorType = "sine",
  gainValue = 0.25,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(gainValue, at + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(dest);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

/** Play precomputed steps immediately (caller ensures <100ms tap response). */
export function playSteps(ctx: BaseAudioContext, dest: AudioNode, steps: ToneStep[]) {
  const now = ctx.currentTime;
  for (const s of steps) {
    tone(ctx, dest, s.freq, now + s.at, s.dur, s.type ?? "sine", s.gain ?? 0.25);
  }
  return steps.reduce((max, s) => Math.max(max, s.at + s.dur), 0);
}

/** Word prosody: 2–3 syllable-like lifts, pitch derived from the word id. */
export function wordSteps(id: string): ToneStep[] {
  const base = voiceFreq(id);
  const syllables = 2 + (hashString(id) % 2);
  const steps: ToneStep[] = [];
  for (let i = 0; i < syllables; i++) {
    steps.push({
      freq: base * (i === syllables - 1 ? 1.25 : 1 + i * 0.06),
      at: i * 0.22,
      dur: 0.2,
      type: "triangle",
    });
  }
  return steps;
}

/** Praise: quick happy arpeggio up. */
export function praiseSteps(id: string): ToneStep[] {
  const base = voiceFreq(id);
  return [0, 1, 2, 3].map((i) => ({
    freq: base * [1, 1.25, 1.5, 2][i],
    at: i * 0.12,
    dur: 0.16,
    type: "triangle" as OscillatorType,
  }));
}

/** Gentle retry: soft two-note descent, never harsh. */
export function retrySteps(id: string): ToneStep[] {
  const base = voiceFreq(id);
  return [
    { freq: base, at: 0, dur: 0.22, type: "sine" as OscillatorType, gain: 0.18 },
    { freq: base * 0.89, at: 0.24, dur: 0.3, type: "sine" as OscillatorType, gain: 0.18 },
  ];
}

/** Celebration stinger ~1.5s: bright rising run. */
export function stingerSteps(): ToneStep[] {
  const base = 392; // G4
  const scale = [1, 1.125, 1.25, 1.5, 1.6875, 2];
  return scale.map((mult, i) => ({
    freq: base * mult,
    at: i * 0.14,
    dur: 0.22,
    type: "triangle" as OscillatorType,
  }));
}

/** One chant beat tick (soft percussion bed under chant lines). */
export function beatSteps(beats: number, beatSec: number): ToneStep[] {
  const steps: ToneStep[] = [];
  for (let i = 0; i < beats; i++) {
    steps.push({
      freq: i % 4 === 0 ? 180 : 140,
      at: i * beatSec,
      dur: 0.09,
      type: "sine",
      gain: 0.12,
    });
  }
  return steps;
}
