import { describe, expect, it } from "vitest";
import { crOf, health, liqPrice } from "@/lib/mezo";
import { cleanNum } from "@/components/ui-bits";
import {
  BORROW_FEE_RATE,
  GAS_COMP_MUSD,
  MIN_BORROW_MUSD,
  borrowingFee,
  effectiveCr,
  expectedTotalDebt,
  formatMUSD,
  invoiceTypedData,
  musdAddressFor,
  parseMUSD,
  validateBorrow,
} from "@/lib/onchain";

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

describe("fee-aware math (1% + 200 gas comp)", () => {
  it("adds fee and gas comp", () => {
    expect(BORROW_FEE_RATE).toBe(0.01);
    expect(GAS_COMP_MUSD).toBe(200);
    expect(borrowingFee(2000)).toBeCloseTo(20);
    expect(expectedTotalDebt(2000)).toBeCloseTo(2220);
  });

  it("enforces the 1,800 minimum borrow", () => {
    expect(validateBorrow(0)).not.toBeNull();
    expect(validateBorrow(250)).not.toBeNull();
    expect(validateBorrow(MIN_BORROW_MUSD)).toBeNull();
  });

  it("lowers effective CR once fees are included", () => {
    const plain = crOf(1, 2000, 68000);
    const eff = effectiveCr(1, 2000, 68000);
    expect(eff).toBeLessThan(plain);
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
