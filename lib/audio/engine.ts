/**
 * Client audio engine (docs/architecture.md section 7.4).
 * - Unlocks on first user tap (browser autoplay rules).
 * - Preloads a world's static clips; missing ids fall back to synth tones.
 * - Every play() starts in the same task as the tap: <100ms feedback.
 * - Chants schedule on the Web Audio clock, never setTimeout.
 */
import { clipUrl, loadManifest, type Manifest } from "./manifest";
import {
  beatSteps,
  playSteps,
  retrySteps,
  stingerSteps,
  wordSteps,
} from "./synth";

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private manifest: Manifest | null = null;
  private muted = false;

  /** Must be called from a user gesture at least once. */
  unlock() {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.02);
    }
  }

  get isMuted() {
    return this.muted;
  }

  private ready(): boolean {
    return !!this.ctx && !!this.master && !this.muted;
  }

  /** Decode once and reuse (no re-fetch on repeat taps). */
  async preload(clipIds: string[]) {
    this.manifest = await loadManifest();
    if (!this.ctx || !this.master) return;
    const missing = clipIds.filter(
      (id) => !this.buffers.has(id) && clipUrl(this.manifest!, id),
    );
    await Promise.all(
      missing.map(async (id) => {
        try {
          const url = clipUrl(this.manifest!, id)!;
          const res = await fetch(url);
          const raw = await res.arrayBuffer();
          const buf = await this.ctx!.decodeAudioData(raw);
          this.buffers.set(id, buf);
        } catch {
          // Keep synth fallback; a failed clip must never break play.
        }
      }),
    );
  }

  private playBuffer(clipId: string): boolean {
    if (!this.ready()) return false;
    const buf = this.buffers.get(clipId);
    if (!buf) return false;
    const src = this.ctx!.createBufferSource();
    src.buffer = buf;
    src.connect(this.master!);
    src.start();
    return true;
  }

  private synth(steps: Parameters<typeof playSteps>[2]) {
    if (!this.ready()) return 0;
    return playSteps(this.ctx!, this.master!, steps);
  }

  /** Speak a word clip (or its synth placeholder). Returns seconds played. */
  playWord(wordId: string): number {
    if (this.playBuffer(`word:${wordId}`)) return 1;
    return this.synth(wordSteps(`word:${wordId}`));
  }

  playPhrase(wordId: string): number {
    if (this.playBuffer(`phrase:${wordId}`)) return 1.2;
    const steps = wordSteps(`phrase:${wordId}`);
    return this.synth([...steps, ...wordSteps(`word:${wordId}`).map((s) => ({ ...s, at: s.at + 0.7 }))]);
  }

  playPrompt(wordId: string): number {
    if (this.playBuffer(`prompt:${wordId}`)) return 1;
    return this.synth(wordSteps(`prompt:${wordId}`));
  }

  /** Any spoken line by clip id (motivation, praise, song line...). */
  playLine(clipId: string): number {
    if (this.playBuffer(clipId)) return 1.2;
    return this.synth(wordSteps(clipId));
  }

  playRetry(setId: string, retryIndex: number): number {
    if (this.playBuffer(`retry:${setId}:${retryIndex}`)) return 0.6;
    return this.synth(retrySteps(`retry:${setId}:${retryIndex}`));
  }

  /** Tier 1: stinger + celebration line repeating the word. */
  playCelebration(wordId: string): number {
    if (!this.ready()) return 0;
    const a = this.playBuffer("stinger:default")
      ? 1.5
      : this.synth(stingerSteps());
    const b = this.playBuffer(`celebration:${wordId}`)
      ? 1.2
      : this.synth(wordSteps(`celebration:${wordId}`));
    return Math.max(a, b);
  }

  /**
   * Tier 2/3: chant lines over a beat bed, scheduled on the audio clock.
   * Returns total seconds so the UI can time the dance + next word.
   */
  playChant(lineIds: string[], beatSec: number): number {
    if (!this.ready()) return 0;
    const beats = Math.max(4, lineIds.length * 2);
    this.synth(beatSteps(beats, beatSec));
    let at = 0;
    lineIds.forEach((id, i) => {
      const steps = wordSteps(id).map((s) => ({ ...s, at: s.at + at }));
      this.synth(steps);
      at += beatSec * 2;
      void i;
    });
    return Math.max(beats * beatSec, at + 0.5);
  }

  stopAll() {
    // Placeholder voices are short fire-and-forget tones; with real TTS
    // clips this will track active sources and stop them (tap-to-skip).
    if (this.ctx && this.ctx.state === "running") void this.ctx.suspend();
    if (this.ctx && this.ctx.state === "suspended" && !this.muted) {
      void this.ctx.resume();
    }
  }
}

export const audio = new AudioEngine();
