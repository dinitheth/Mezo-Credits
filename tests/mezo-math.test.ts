import { describe, expect, it } from "vitest";
import { crOf, health, liqPrice } from "@/lib/mezo";
import { cleanNum } from "@/components/ui-bits";
import { formatMUSD, invoiceTypedData, musdAddressFor, parseMUSD } from "@/lib/onchain";

describe("collateral math", () => {
  it("computes CR and liquidation price", () => {
    expect(crOf(1, 34000, 68000)).toBeCloseTo(200);
    expect(liqPrice(1, 34000)).toBeCloseTo(37400);
    expect(crOf(1, 0, 68000)).toBe(Infinity);
  });

  it("bands health scores", () => {
    expect(health(Infinity).label).toBe("No debt");
    expect(health(250).label).toBe("Healthy");
    expect(health(175).label).toBe("Moderate");
    expect(health(120).label).toBe("At risk");
  });
});

describe("input validation", () => {
  it("cleans numeric input to digits + one dot", () => {
    expect(cleanNum("12,5")).toBe("12.5");
    expect(cleanNum("abc0.05..6", 2)).toBe("0.05");
    expect(cleanNum(".5")).toBe("0.5");
  });
});

describe("MUSD units + addresses", () => {
  it("round-trips wei encoding", () => {
    expect(parseMUSD("1.5")).toBe(1500000000000000000n);
    expect(formatMUSD(1500000000000000000n)).toBe("1.50");
  });

  it("resolves testnet vs mainnet MUSD without touching RPC constants", () => {
    expect(musdAddressFor(31611)).toBe("0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503");
    expect(musdAddressFor(31612)).toBe("0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186");
    expect(musdAddressFor(1)).toBeNull();
  });
});

describe("EIP-712 invoice intent", () => {
  it("builds typed data with exact amount/to/deadline", () => {
    const typed = invoiceTypedData(31611, "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503", {
      id: "abc123",
      amount: 250,
      to: "0x0000000000000000000000000000000000000001",
      desc: "Design",
      deadline: 123,
      nonce: "1",
    });
    expect(typed.primaryType).toBe("Invoice");
    expect(typed.domain.chainId).toBe(31611);
    expect(typed.message.id).toBe("abc123");
  });
});
