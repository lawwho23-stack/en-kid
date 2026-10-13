import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

type HeaderRule = {
  source: string;
  headers: Array<{ key: string; value: string }>;
};

async function configuredHeaders(): Promise<HeaderRule[]> {
  const headers = nextConfig.headers;
  return headers ? ((await headers()) as HeaderRule[]) : [];
}

function cacheControl(rules: HeaderRule[], source: string): string | undefined {
  return rules
    .find((rule) => rule.source === source)
    ?.headers.find((header) => header.key.toLowerCase() === "cache-control")
    ?.value;
}

describe("audio cache policy", () => {
  it("caches content-hashed MP3 files as immutable", async () => {
    const rules = await configuredHeaders();

    expect(cacheControl(rules, "/audio/clips/:path*")).toBe(
      "public, max-age=31536000, immutable",
    );
  });

  it("always revalidates the manifest and service worker", async () => {
    const rules = await configuredHeaders();

    expect(cacheControl(rules, "/audio/audio-manifest.json")).toBe(
      "public, max-age=0, must-revalidate",
    );
    expect(cacheControl(rules, "/sw.js")).toBe(
      "no-cache, no-store, must-revalidate",
    );
  });
});
