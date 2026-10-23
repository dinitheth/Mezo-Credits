import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatMUSD,
  getBtcBalance,
  getIncomingMusdTransfers,
  getInvoicePaidEvents,
  getMezoTokenBalance,
  getMusdBalance,
  invoiceTypedData,
  mezoTokenAddressFor,
  musdAddressFor,
  parseMUSD,
  routerAddressFor,
  sendMusd,
  vaultAddressFor,
} from "@/lib/onchain";

const ADDR = "0x5555555555555555555555555555555555555555";
const TO = "0x2222222222222222222222222222222222222222";
const TOKEN = "0x3333333333333333333333333333333333333333";
const word = (n: bigint) => `0x${n.toString(16).padStart(64, "0")}`;

afterEach(() => {
  delete (window as unknown as { ethereum?: unknown }).ethereum;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("MUSD amounts", () => {
  it("round-trips whole and fractional amounts", () => {
    expect(parseMUSD("0")).toBe(0n);
    expect(parseMUSD("1")).toBe(10n ** 18n);
    expect(parseMUSD("1.5")).toBe(1_500_000_000_000_000_000n);
    expect(parseMUSD("0.000000000000000001")).toBe(1n);
    expect(formatMUSD(1_500_000_000_000_000_000n)).toBe("1.50");
    expect(formatMUSD(1_999_999_999_999_999_999n)).toBe("1.99");
    expect(formatMUSD(-1_500_000_000_000_000_000n)).toBe("-1.50");
  });

  it("cuts extra decimals instead of inventing precision", () => {
    expect(parseMUSD("1.1234567890123456789")).toBe(1_123_456_789_012_345_678n);
  });

  it("refuses malformed input", () => {
    expect(() => parseMUSD("1,5")).toThrow("Invalid MUSD amount.");
    expect(() => parseMUSD("-1")).toThrow("Invalid MUSD amount.");
    expect(() => parseMUSD("abc")).toThrow("Invalid MUSD amount.");
    expect(() => parseMUSD("")).toThrow("Invalid MUSD amount.");
  });
});

describe("known contracts", () => {
  it("uses the deployed testnet MUSD address", () => {
    expect(musdAddressFor(31611)?.toLowerCase()).toBe("0x118917a40faf1cd7a13db0ef56c86de7973ac503");
    expect(musdAddressFor(31612)?.toLowerCase()).toBe("0xdd468a1ddc392dcdbef6db6e34e89aa338f9f186");
    expect(musdAddressFor(1)).toBeNull();
    expect(musdAddressFor(null)).toBeNull();
  });

  it("has a payable testnet router and vault, but no unknown-chain fallback", () => {
    expect(routerAddressFor(31611)).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(vaultAddressFor(31611)).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(routerAddressFor(1)).toBeNull();
    expect(vaultAddressFor(1)).toBeNull();
    expect(routerAddressFor(null)).toBeNull();
    expect(vaultAddressFor(null)).toBeNull();
  });

  it("does not invent a MEZO token address", () => {
    expect(mezoTokenAddressFor(1)).toBeNull();
    expect(mezoTokenAddressFor(null)).toBeNull();
  });

  it("returns an empty log list on unsupported chains without calling the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(getInvoicePaidEvents(1)).resolves.toEqual([]);
    await expect(getIncomingMusdTransfers(1, ADDR)).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("wallet reads", () => {
  it("returns null for a missing MEZO token instead of making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(getMezoTokenBalance(ADDR, null)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("decodes token and native balances from the wallet", async () => {
    const request = vi.fn(async ({ method }: { method: string }) => {
      if (method === "eth_call") return word(5n * 10n ** 18n);
      if (method === "eth_getBalance") return "0xde0b6b3a7640000";
      throw new Error(method);
    });
    (window as unknown as { ethereum: unknown }).ethereum = { request };

    await expect(getMezoTokenBalance(ADDR, TOKEN)).resolves.toBe(5);
    await expect(getMusdBalance(ADDR, TOKEN)).resolves.toBe(5);
    await expect(getBtcBalance(ADDR)).resolves.toBe(1);
  });
});

describe("payment guardrails", () => {
  it("checks the recipient and amount before asking the wallet to send", async () => {
    await expect(sendMusd("not-a-wallet", 1, TOKEN, ADDR)).rejects.toThrow(
      "Invalid recipient address.",
    );
    await expect(sendMusd(TO, 0, TOKEN, ADDR)).rejects.toThrow("Amount must be above zero.");
  });
});

describe("signed bill intent", () => {
  it("signs the exact amount in smallest units with the bill details", () => {
    const typed = invoiceTypedData(31611, TOKEN, {
      id: "bill-1",
      amount: 25.5,
      to: TO,
      desc: "Design work",
      deadline: 1_700_000_000,
      nonce: "nonce-1",
    });

    expect(typed.domain).toEqual({
      name: "MezoFlow",
      version: "1",
      chainId: 31611,
      verifyingContract: TOKEN,
    });
    expect(typed.message).toEqual({
      id: "bill-1",
      amount: "25500000000000000000",
      to: TO,
      desc: "Design work",
      deadline: 1_700_000_000,
      nonce: "nonce-1",
    });
    expect(typed.types.Invoice.map((f) => f.name)).toEqual([
      "id",
      "amount",
      "to",
      "desc",
      "deadline",
      "nonce",
    ]);
  });
});
