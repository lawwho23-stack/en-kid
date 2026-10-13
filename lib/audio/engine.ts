/**
 * Client audio engine (docs/architecture.md section 7.4).
 * - Unlocks on first user tap (browser autoplay rules).
 * - Preloads a world's static clips; missing ids fall back to synth tones.
 * - Every play() starts in the same task as the tap: <100ms feedback.
 * - Chants schedule on the Web Audio clock, never setTimeout.
 */
import { clipUrl, loadManifest, reloadManifest, type Manifest } from "./manifest";
import {
  playSteps,
  retrySteps,
  songSteps,
  stingerSteps,
  wordSteps,
} from "./synth";

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private pending = new Map<string, Promise<void>>();
  private manifest: Manifest | null = null;
  private manifestPromise: Promise<Manifest> | null = null;
  private activeSources = new Set<AudioScheduledSourceNode>();
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

  /** Nudge a suspended context (autoplay policy). Safe to call anywhere. */
  private nudge() {
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume().catch(() => {
        // Still blocked: the next real tap retries via unlock().
      });
    }
  }

  /**
   * Re-fetch the manifest and drop decoded buffers whose packaged URL
   * changed (content hash changed). Old immutable clips stay cached.
   */
  async refreshManifest(): Promise<Manifest> {
    const old = this.manifest;
    const fresh = await reloadManifest();
    if (old && fresh.version !== old.version) {
      for (const [id, url] of Object.entries(old.clips)) {
        if (fresh.clips[id] !== url) this.buffers.delete(id);
      }
    }
    this.manifest = fresh;
    this.manifestPromise = Promise.resolve(fresh);
    return fresh;
  }

  /** Decode once and reuse (no re-fetch on repeat taps). */
  async preload(clipIds: string[], opts?: { reloadManifest?: boolean }) {
    if (opts?.reloadManifest) {
      await this.refreshManifest();
    } else {
      if (!this.manifestPromise) this.manifestPromise = loadManifest();
      this.manifest = await this.manifestPromise;
    }
    if (!this.ctx || !this.master) return;

    const missing = [...new Set(clipIds)].filter(
      (id) => !this.buffers.has(id),
    );
    await Promise.all(
      missing.map((id) => {
        const existing = this.pending.get(id);
        if (existing) return existing;

        const request = this.loadClip(id).finally(() => {
          this.pending.delete(id);
        });
        this.pending.set(id, request);
        return request;
      }),
    );
  }

  private async loadClip(clipId: string): Promise<void> {
    const packaged = clipUrl(this.manifest!, clipId);
    const api = `/api/audio/${encodeURIComponent(clipId)}`;
    const candidates = [...new Set([packaged, api].filter(Boolean))] as string[];

    for (const url of candidates) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const raw = await res.arrayBuffer();
        const buf = await this.ctx!.decodeAudioData(raw);
        this.buffers.set(clipId, buf);
        return;
      } catch {
        // Try the explicit database fallback, then keep synth as last resort.
      }
    }
  }

  private track(source: AudioScheduledSourceNode) {
    this.activeSources.add(source);
    source.addEventListener?.("ended", () => {
      this.activeSources.delete(source);
    }, { once: true });
  }

  private playBufferAt(clipId: string, at: number): AudioBuffer | null {
    if (!this.ready()) return null;
    const buf = this.buffers.get(clipId);
    if (!buf) return null;
    const src = this.ctx!.createBufferSource();
    src.buffer = buf;
    src.connect(this.master!);
    this.track(src);
    src.start(at);
    return buf;
  }

  private playBuffer(clipId: string): boolean {
    this.nudge();
    if (!this.ready()) return false;
    return !!this.playBufferAt(clipId, this.ctx!.currentTime);
  }

  private synth(steps: Parameters<typeof playSteps>[2]) {
    this.nudge();
    if (!this.ready()) return 0;
    return playSteps(this.ctx!, this.master!, steps, (source) =>
      this.track(source),
    );
  }

  /** Speak a word clip (or its synth placeholder). Returns seconds played. */
  playWord(wordId: string): number {
    if (this.playBuffer(`word:${wordId}`)) return 1;
    return this.synth(wordSteps(`word:${wordId}`));
  }

  /** Character greeting ("Hi! I am Momo!"). Sound-check on world entry. */
  playGreeting(characterId: string): number {
    if (this.playBuffer(`greeting:${characterId}`)) return 2;
    return this.synth(wordSteps(`greeting:${characterId}`));
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
    // Stop any prompt/retry still ringing so the celebration starts clean.
    // (Chant path already stops via playChant; Continue path stops via UI.)
    this.stopAll();
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
    this.stopAll();
    const startedAt = this.ctx!.currentTime;
    let at = 0;
    for (const id of lineIds) {
      const buffer = this.playBufferAt(id, startedAt + at);
      const fallback = buffer ? [] : wordSteps(id);
      if (fallback.length > 0) {
        this.synth(fallback.map((step) => ({ ...step, at: step.at + at })));
      }
      const spokenDuration = buffer?.duration ?? Math.max(
        ...fallback.map((step) => step.at + step.dur),
        0.6,
      );
      const lineBeats = Math.max(
        2,
        Math.ceil((spokenDuration + 0.15) / beatSec),
      );
      at += lineBeats * beatSec;
    }

    const beats = Math.max(4, Math.ceil(at / beatSec));
    this.synth(songSteps(beats, beatSec));
    return at;
  }

  stopAll() {
    for (const source of this.activeSources) {
      try {
        source.stop();
      } catch {
        // A source that already ended is safe to forget.
      }
    }
    this.activeSources.clear();
  }
}

export const audio = new AudioEngine();
