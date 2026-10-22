import { describe, expect, it } from "vitest";
import { PRICE_STALE_SECONDS, priceAgeLabel, priceAgeSeconds, priceIsStale } from "@/lib/onchain";

const NOW = 1_700_000_000_000;
const at = (secondsAgo: number) => BigInt(Math.floor(NOW / 1000) - secondsAgo);

describe("pool price age", () => {
  it("counts whole seconds since the price was posted", () => {
    expect(priceAgeSeconds(at(0), NOW)).toBe(0);
    expect(priceAgeSeconds(at(120), NOW)).toBe(120);
    expect(priceAgeSeconds(at(3600), NOW)).toBe(3600);
  });

  it("treats a missing or zero timestamp as unknown", () => {
    expect(priceAgeSeconds(0n, NOW)).toBe(Number.POSITIVE_INFINITY);
    expect(priceAgeSeconds(null, NOW)).toBe(Number.POSITIVE_INFINITY);
    expect(priceAgeSeconds(undefined, NOW)).toBe(Number.POSITIVE_INFINITY);
  });

  it("never shows a negative age when clocks drift", () => {
    expect(priceAgeSeconds(at(-30), NOW)).toBe(0);
  });
});

describe("plain-word price age labels", () => {
  it("labels fresh, minutes, hours and days", () => {
    expect(priceAgeLabel(at(10), NOW)).toBe("just now");
    expect(priceAgeLabel(at(120), NOW)).toBe("2 min ago");
    expect(priceAgeLabel(at(3 * 3600), NOW)).toBe("3 h ago");
    expect(priceAgeLabel(at(3 * 86400), NOW)).toBe("3 days ago");
    expect(priceAgeLabel(0n, NOW)).toBe("never");
  });
});

describe("stale price guard", () => {
  it("keeps prices up to 15 minutes fresh", () => {
    expect(PRICE_STALE_SECONDS).toBe(900);
    expect(priceIsStale(at(PRICE_STALE_SECONDS), NOW)).toBe(false);
    expect(priceIsStale(at(PRICE_STALE_SECONDS - 1), NOW)).toBe(false);
  });

  it("pauses after 15 minutes or when the price was never set", () => {
    expect(priceIsStale(at(PRICE_STALE_SECONDS + 1), NOW)).toBe(true);
    expect(priceIsStale(0n, NOW)).toBe(true);
    expect(priceIsStale(null, NOW)).toBe(true);
  });
});
