import { afterEach, describe, expect, it, vi } from "vitest";

class FakeAudioParam {
  value = 0;
  setTargetAtTime() {}
  setValueAtTime() {}
  exponentialRampToValueAtTime() {}
}

class FakeGain {
  gain = new FakeAudioParam();
  connect(node: unknown) {
    return node;
  }
}

class FakeBufferSource {
  buffer: { duration: number } | null = null;
  starts: number[] = [];
  stops: Array<number | undefined> = [];

  connect(node: unknown) {
    return node;
  }

  start(at?: number) {
    this.starts.push(at ?? 0);
  }

  stop(at?: number) {
    this.stops.push(at);
  }
}

class FakeOscillator {
  type: OscillatorType = "sine";
  frequency = new FakeAudioParam();
  starts: number[] = [];
  stops: Array<number | undefined> = [];

  connect(node: unknown) {
    return node;
  }

  start(at?: number) {
    this.starts.push(at ?? 0);
  }

  stop(at?: number) {
    this.stops.push(at);
  }
}

class FakeAudioContext {
  currentTime = 10;
  destination = {};
  state: AudioContextState = "running";
  readonly sources: FakeBufferSource[] = [];
  readonly oscillators: FakeOscillator[] = [];

  createGain() {
    return new FakeGain();
  }

  createBufferSource() {
    const source = new FakeBufferSource();
    this.sources.push(source);
    return source;
  }

  createOscillator() {
    const oscillator = new FakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  }

  async decodeAudioData(raw: ArrayBuffer) {
    const duration = Number(new TextDecoder().decode(raw));
    return { duration };
  }

  async resume() {
    this.state = "running";
  }

  async suspend() {
    this.state = "suspended";
  }
}

type Engine = {
  unlock(): void;
  preload(ids: string[], opts?: { reloadManifest?: boolean }): Promise<void>;
  playWord(id: string): number;
  playCelebration(id: string): number;
  playChant(ids: string[], beatSec: number): number;
  refreshManifest(): Promise<unknown>;
  stopAll(): void;
};

async function createEngine(options: {
  clips: Record<string, string>;
  assets: Record<string, { status?: number; duration: number }>;
}) {
  vi.resetModules();
  const context = new FakeAudioContext();
  const fetcher = vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url === "/audio/audio-manifest.json") {
      return new Response(JSON.stringify({ version: 1, clips: options.clips }), {
        headers: { "content-type": "application/json" },
      });
    }
    const asset = options.assets[url];
    if (!asset) return new Response("missing", { status: 404 });
    return new Response(String(asset.duration), { status: asset.status ?? 200 });
  });

  vi.stubGlobal("fetch", fetcher);
  vi.stubGlobal("window", {
    AudioContext: class {
      constructor() {
        return context;
      }
    },
  });

  const { audio } = await import("./engine");
  const AudioEngine = audio.constructor as new () => Engine;
  const engine = new AudioEngine();
  engine.unlock();

  return { context, engine, fetcher };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AudioEngine", () => {
  it("downloads and decodes a duplicate static clip only once", async () => {
    const setup = await createEngine({
      clips: { "word:cat": "/audio/clips/word-cat.mp3" },
      assets: { "/audio/clips/word-cat.mp3": { duration: 1.2 } },
    });

    await setup.engine.preload(["word:cat", "word:cat"]);

    const assetRequests = setup.fetcher.mock.calls.filter(
      ([url]) => String(url) !== "/audio/audio-manifest.json",
    );
    expect(assetRequests.map(([url]) => String(url))).toEqual([
      "/audio/clips/word-cat.mp3",
    ]);
  });

  it("uses the audio API only after the packaged file fails", async () => {
    const setup = await createEngine({
      clips: { "word:cat": "/audio/clips/word-cat.mp3" },
      assets: {
        "/audio/clips/word-cat.mp3": { status: 404, duration: 0 },
        "/api/audio/word%3Acat": { duration: 1.2 },
      },
    });

    await setup.engine.preload(["word:cat"]);
    setup.engine.playWord("cat");

    const assetRequests = setup.fetcher.mock.calls
      .map(([url]) => String(url))
      .filter((url) => url !== "/audio/audio-manifest.json");
    expect(assetRequests).toEqual([
      "/audio/clips/word-cat.mp3",
      "/api/audio/word%3Acat",
    ]);
    expect(setup.context.sources).toHaveLength(1);
  });

  it("schedules decoded chant voices on non-overlapping beat boundaries", async () => {
    const setup = await createEngine({
      clips: {
        "line:first": "/audio/clips/first.mp3",
        "line:second": "/audio/clips/second.mp3",
      },
      assets: {
        "/audio/clips/first.mp3": { duration: 2.2 },
        "/audio/clips/second.mp3": { duration: 1.8 },
      },
    });
    await setup.engine.preload(["line:first", "line:second"]);

    const duration = setup.engine.playChant(
      ["line:first", "line:second"],
      0.5,
    );

    expect(setup.context.sources.map((source) => source.starts[0])).toEqual([
      10,
      12.5,
    ]);
    expect(duration).toBe(4.5);
    expect(setup.context.oscillators.length).toBeGreaterThan(4);
    expect(
      setup.context.oscillators.some(
        (oscillator) => oscillator.frequency.value >= 260,
      ),
    ).toBe(true);

    setup.engine.stopAll();
    expect(
      setup.context.sources.every((source) => source.stops.includes(undefined)),
    ).toBe(true);
    expect(
      setup.context.oscillators.every((oscillator) =>
        oscillator.stops.includes(undefined),
      ),
    ).toBe(true);
  });

  it("drops decoded audio whose packaged URL changed after a manifest refresh", async () => {
    let clips = { "word:cat": "/audio/clips/cat-v1.mp3" };
    let version = 1;
    vi.resetModules();
    const context = new FakeAudioContext();
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url === "/audio/audio-manifest.json") {
        return new Response(JSON.stringify({ version, clips }), {
          headers: { "content-type": "application/json" },
        });
      }
      if (url === "/audio/clips/cat-v1.mp3") return new Response("1.0");
      if (url === "/audio/clips/cat-v2.mp3") return new Response("1.0");
      return new Response("missing", { status: 404 });
    });
    vi.stubGlobal("fetch", fetcher);
    vi.stubGlobal("window", {
      AudioContext: class {
        constructor() {
          return context;
        }
      },
    });
    const { audio } = await import("./engine");
    const AudioEngine = audio.constructor as new () => Engine;
    const engine = new AudioEngine();
    engine.unlock();

    await engine.preload(["word:cat"]);
    expect(context.sources).toHaveLength(0);
    engine.playWord("cat");
    expect(context.sources).toHaveLength(1);

    // Deploy changes the hashed URL for the same clip id.
    clips = { "word:cat": "/audio/clips/cat-v2.mp3" };
    version = 2;
    await engine.refreshManifest();

    // Old buffer is gone: playback falls back to synth until re-preloaded.
    const sourcesBefore = context.sources.length;
    const oscillatorsBefore = context.oscillators.length;
    engine.playWord("cat");
    expect(context.sources).toHaveLength(sourcesBefore);
    expect(context.oscillators.length).toBeGreaterThan(oscillatorsBefore);

    // Re-preload fetches the new URL and plays decoded audio again.
    await engine.preload(["word:cat"]);
    engine.playWord("cat");
    expect(context.sources.length).toBeGreaterThan(sourcesBefore);
  });

  it("stops a ringing chant when a Tier 1 celebration starts (tap-to-continue)", async () => {
    const setup = await createEngine({
      clips: {
        "chant:cat": "/audio/clips/chant.mp3",
        "line:hi": "/audio/clips/hi.mp3",
        "celebration:cat": "/audio/clips/cel.mp3",
      },
      assets: {
        "/audio/clips/chant.mp3": { duration: 1.0 },
        "/audio/clips/hi.mp3": { duration: 1.0 },
        "/audio/clips/cel.mp3": { duration: 1.0 },
      },
    });
    await setup.engine.preload(["chant:cat", "line:hi", "celebration:cat"]);

    setup.engine.playChant(["chant:cat", "line:hi"], 0.5);
    const chantSources = [...setup.context.sources];
    expect(chantSources.length).toBeGreaterThan(0);

    setup.engine.playCelebration("cat");

    expect(chantSources.every((s) => s.stops.includes(undefined))).toBe(true);
  });
});
