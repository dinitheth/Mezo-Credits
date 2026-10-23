import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Activity } from "@/lib/mezo";

const ADDR = "0x5555555555555555555555555555555555555555";
const TX1 = `0x${"a".repeat(64)}`;
const TX2 = `0x${"b".repeat(64)}`;

async function freshStore() {
  vi.resetModules();
  return import("@/lib/mezo");
}

const entry = (tx: string, over: Record<string, unknown> = {}): Activity =>
  ({
    id: tx.slice(2, 14),
    ts: 1_700_000_000_000,
    kind: "transfer",
    amount: 1,
    unit: "MUSD",
    status: "confirmed",
    tx,
    onchain: true,
    ...over,
  }) as Activity;

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("saved browser state", () => {
  it("keeps only real, receipt-backed activity when it loads", async () => {
    const { hydrateStore, getState } = await freshStore();
    localStorage.setItem(
      "mezoflow",
      JSON.stringify({
        invoices: [],
        activity: [
          entry(TX1),
          entry(TX2, { onchain: false }),
          entry("not-a-receipt", { tx: 42 }),
          { ...entry("old"), kind: "shield_repay" },
        ],
      }),
    );

    hydrateStore();

    expect(getState().activity.map((a) => a.tx)).toEqual([TX1, "old"]);
  });

  it("unmarks a paid bill when its receipt is not in the saved activity", async () => {
    const { hydrateStore, getState } = await freshStore();
    localStorage.setItem(
      "mezoflow",
      JSON.stringify({
        invoices: [
          { id: "kept", amount: 5, description: "Kept", recipient: ADDR, paid: true, tx: TX1 },
          { id: "lost", amount: 6, description: "Lost", recipient: ADDR, paid: true, tx: TX2 },
        ],
        activity: [entry(TX1)],
      }),
    );

    hydrateStore();

    const [kept, lost] = getState().invoices;
    expect(kept?.paid).toBe(true);
    expect(kept?.tx).toBe(TX1);
    expect(lost?.paid).toBe(false);
    expect(lost?.tx).toBeUndefined();
  });

  it("remembers a valid last wallet but ignores a malformed one", async () => {
    const { hydrateStore, getState } = await freshStore();
    localStorage.setItem("mezoflow_last_wallet", ADDR);
    hydrateStore();
    expect(getState().lastWallet).toBe(ADDR);

    vi.resetModules();
    localStorage.clear();
    localStorage.setItem("mezoflow_last_wallet", "not-a-wallet");
    const again = await import("@/lib/mezo");
    again.hydrateStore();
    expect(again.getState().lastWallet).toBeNull();
  });

  it("saves the chosen wallet for a one-tap reconnect", async () => {
    const { setState, getState } = await freshStore();
    setState({ account: ADDR, chainId: 31611 });
    expect(localStorage.getItem("mezoflow_last_wallet")).toBe(ADDR);
    expect(getState().lastWallet).toBe(ADDR);

    setState({ account: null });
    expect(localStorage.getItem("mezoflow_last_wallet")).toBeNull();
    expect(getState().lastWallet).toBeNull();
  });
});

describe("payment history", () => {
  it("only records a payment when there is a real receipt hash", async () => {
    const { logActivity, getState } = await freshStore();
    expect(logActivity("transfer", 1, "MUSD", "no receipt")).toBe("");
    expect(getState().activity).toHaveLength(0);

    expect(logActivity("transfer", 1, "MUSD", "paid", TX1)).toBe(TX1);
    expect(getState().activity[0]).toMatchObject({
      id: TX1.slice(2, 14),
      tx: TX1,
      status: "confirmed",
      onchain: true,
    });
  });

  it("keeps the newest 500 entries", async () => {
    const { setState, logActivity, getState } = await freshStore();
    setState({
      activity: Array.from({ length: 500 }, (_, i) =>
        entry(`0x${i.toString(16).padStart(64, "0")}`),
      ),
    });
    logActivity("transfer", 2, "MUSD", "newest", TX2);
    expect(getState().activity).toHaveLength(500);
    expect(getState().activity[0]?.tx).toBe(TX2);
  });

  it("corrects a payment after the network reports a failure", async () => {
    const { setState, setActivityStatus, getState } = await freshStore();
    setState({ activity: [entry(TX1), entry(TX2)] });
    setActivityStatus(TX1, "failed");
    expect(getState().activity.find((a) => a.tx === TX1)?.status).toBe("failed");
    expect(getState().activity.find((a) => a.tx === TX2)?.status).toBe("confirmed");
  });
});

describe("live Bitcoin price", () => {
  it("falls back from Coinbase to Binance", async () => {
    const { fetchBtcPrice } = await freshStore();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ price: "70123.5" }) });
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchBtcPrice()).toBe(70123.5);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses CoinGecko when the first two feeds return unusable values", async () => {
    const { fetchBtcPrice } = await freshStore();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { amount: "nope" } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ price: "0" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ bitcoin: { usd: 69_500 } }) });
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchBtcPrice()).toBe(69_500);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("returns zero when every feed is offline", async () => {
    const { fetchBtcPrice } = await freshStore();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await fetchBtcPrice()).toBe(0);
  });
});
