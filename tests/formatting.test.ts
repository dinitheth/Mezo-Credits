import { describe, expect, it } from "vitest";
import { crOf, health, liqPrice, num, sats, short, usd } from "@/lib/mezo";

const ADDR = "0x5555555555555555555555555555555555555555";

describe("money words", () => {
  it("formats dollars and token amounts for people", () => {
    expect(usd(68_000)).toBe("$68,000.00");
    expect(usd(1.005)).toBe("$1.01");
    expect(num(42.5, 2)).toBe("42.5");
    expect(num(1_234_567.891, 2)).toBe("1,234,567.89");
    expect(num(0.01, 8)).toBe("0.01");
    expect(sats(0.00012345)).toBe("12,345");
  });

  it("shortens a wallet without hiding both ends", () => {
    expect(short(ADDR)).toBe("0x5555…5555");
  });
});

describe("loan safety boundaries", () => {
  it("keeps 200% and above healthy", () => {
    expect(health(200).label).toBe("Healthy");
    expect(health(200).score).toBe(60);
    expect(health(250).score).toBe(70);
    expect(health(10_000).score).toBe(100);
  });

  it("treats 150% as moderate and just below as at risk", () => {
    expect(health(150).label).toBe("Moderate");
    expect(health(150).score).toBe(35);
    expect(health(199.9).label).toBe("Moderate");
    expect(health(149.9).label).toBe("At risk");
  });

  it("puts the 110% line at zero rather than below zero", () => {
    expect(health(110).label).toBe("At risk");
    expect(health(110).score).toBe(0);
    expect(health(0).score).toBe(0);
    expect(health(Infinity).label).toBe("No debt");
    expect(health(Infinity).score).toBe(100);
  });

  it("computes ratios and danger prices without dividing by zero", () => {
    expect(crOf(1, 34_000, 68_000)).toBe(200);
    expect(crOf(1, 0, 68_000)).toBe(Infinity);
    expect(crOf(0, 100, 68_000)).toBe(0);
    expect(liqPrice(1, 34_000)).toBe(37_400);
    expect(liqPrice(0, 34_000)).toBe(0);
    expect(liqPrice(1, 0)).toBe(0);
  });
});
