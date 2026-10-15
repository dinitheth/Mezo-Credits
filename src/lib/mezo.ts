import { useEffect, useState, useSyncExternalStore } from "react";

export const MEZO = {
  chainId: 31611,
  chainIdHex: "0x7b7b",
  name: "Mezo Testnet",
  rpc: "https://rpc.test.mezo.org",
  explorer: "https://explorer.test.mezo.org",
  faucet: "https://faucet.test.mezo.org/",
};

export const TIERS = [
  { id: "conservative", label: "Conservative", cr: 250, note: "Large safety buffer" },
  { id: "balanced", label: "Balanced", cr: 200, note: "Everyday borrowing" },
  { id: "active", label: "Active", cr: 150, note: "Close to the 110% floor" },
] as const;

export const MIN_CR = 110; // Mezo liquidation threshold
export const SAFE_CR = 150; // collateral withdrawals must keep CR at or above this
export const POOL = { apy: 8.4, baseStaked: 12_480_000 }; // simulated pool metrics

export type Position = { collateral: number; debt: number; pool: number };
export type Invoice = {
  id: string;
  amount: number;
  description: string;
  recipient: string;
  paid?: boolean;
  tx?: string;
};
export type ActivityKind =
  | "borrow"
  | "add_collateral"
  | "withdraw_collateral"
  | "repay"
  | "pool_deposit"
  | "pool_withdraw"
  | "claim_rewards"
  | "compound_rewards"
  | "invoice_created"
  | "invoice_paid"
  | "shield_repay";
export type Activity = {
  id: string;
  ts: number;
  kind: ActivityKind;
  amount: number;
  unit: "BTC" | "MUSD";
  status: "confirmed" | "failed";
  tx: string;
  note?: string | undefined;
  onchain?: boolean | undefined;
};
export type Shield = { enabled: boolean; trigger: number; alerts: boolean };

type State = {
  account: string | null;
  chainId: number | null;
  btcPrice: number;
  position: Position;
  invoices: Invoice[];
  activity: Activity[];
  rewardsBtc: number;
  shield: Shield;
};

let state: State = {
  account: null,
  chainId: null,
  btcPrice: 68000,
  position: { collateral: 0, debt: 0, pool: 0 },
  invoices: [],
  activity: [],
  rewardsBtc: 0,
  shield: { enabled: false, trigger: 135, alerts: true },
};
const subs = new Set<() => void>();
const emit = () => {
  subs.forEach((s) => s());
  if (typeof window !== "undefined")
    localStorage.setItem(
      "mezoflow",
      JSON.stringify({
        position: state.position,
        invoices: state.invoices,
        activity: state.activity,
        rewardsBtc: state.rewardsBtc,
        shield: state.shield,
      }),
    );
};
export function setState(p: Partial<State>) {
  state = { ...state, ...p };
  emit();
}
export function getState() {
  return state;
}

/** Append an entry to the activity ledger and return its (simulated) tx hash. Pass onchain=true when tx was broadcast via the wallet. */
export function logActivity(
  kind: ActivityKind,
  amount: number,
  unit: "BTC" | "MUSD",
  note?: string,
  tx = fakeTx(),
  onchain = false,
) {
  const entry: Activity = {
    id: tx.slice(2, 14),
    ts: Date.now(),
    kind,
    amount,
    unit,
    status: "confirmed",
    tx,
    note,
    onchain: onchain || undefined,
  };
  setState({ activity: [entry, ...state.activity].slice(0, 500) });
  return tx;
}
let loaded = false;
export function hydrateStore() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem("mezoflow");
    if (raw) state = { ...state, ...JSON.parse(raw) };
  } catch {
    // Corrupted persist is ignored; state stays at defaults.
  }
  subs.forEach((s) => s());
}
export function useStore() {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => state,
    () => state,
  );
}

export function fakeTx() {
  const h = "0123456789abcdef";
  let s = "0x";
  for (let i = 0; i < 64; i++) s += h[Math.floor(Math.random() * 16)];
  return s;
}

export const crOf = (coll: number, debt: number, price: number) =>
  debt > 0 ? (coll * price * 100) / debt : Infinity;
export const liqPrice = (coll: number, debt: number) =>
  coll > 0 ? (debt * MIN_CR) / 100 / coll : 0;
export function health(cr: number) {
  if (!isFinite(cr)) return { label: "No debt", tone: "success" as const, score: 100 };
  if (cr >= 200)
    return {
      label: "Healthy",
      tone: "success" as const,
      score: Math.min(100, Math.round(60 + (cr - 200) / 5)),
    };
  if (cr >= 150)
    return { label: "Moderate", tone: "warning" as const, score: Math.round(35 + (cr - 150) / 2) };
  return {
    label: "At risk",
    tone: "destructive" as const,
    score: Math.max(0, Math.round((cr - MIN_CR) * 0.85)),
  };
}

export const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
export const num = (n: number, d = 4) => n.toLocaleString("en-US", { maximumFractionDigits: d });
export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

type Eth = {
  request: (a: { method: string; params?: unknown }) => Promise<unknown>;
  on?: (e: string, f: (x: unknown) => void) => void;
};
const eth = (): Eth | undefined =>
  typeof window !== "undefined" ? (window as unknown as { ethereum?: Eth }).ethereum : undefined;

export async function connectWallet() {
  const e = eth();
  if (!e) throw new Error("No browser wallet found. Install MetaMask or another EVM wallet.");
  const [acc] = (await e.request({ method: "eth_requestAccounts" })) as string[];
  const cid = parseInt((await e.request({ method: "eth_chainId" })) as string, 16);
  setState({ account: acc, chainId: cid });
  e.on?.("accountsChanged", (a: unknown) => setState({ account: (a as string[])[0] ?? null }));
  e.on?.("chainChanged", (c: unknown) => setState({ chainId: parseInt(c as string, 16) }));
}

export async function switchToMezo() {
  const e = eth();
  if (!e) throw new Error("No browser wallet found.");
  try {
    await e.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: MEZO.chainIdHex }],
    });
  } catch (err: unknown) {
    const code = (err as { code?: number }).code;
    const message = (err as { message?: string }).message ?? "";
    if (code === 4902 || /Unrecognized|not been added/i.test(message)) {
      await e.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: MEZO.chainIdHex,
            chainName: MEZO.name,
            nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
            rpcUrls: [MEZO.rpc],
            blockExplorerUrls: [MEZO.explorer],
          },
        ],
      });
    } else throw err;
  }
  setState({ chainId: MEZO.chainId });
}

const TICK_MS = 3000;
let lastAlert = 0;

/** One simulation tick: accrue pool rewards and run the liquidation shield. */
function simTick() {
  const s = getState();
  const { collateral, debt, pool } = s.position;
  // Pool rewards: APY on MUSD deposit, paid in BTC (sped up 1000x so it is visible in a demo).
  const accrued =
    pool > 0
      ? (((pool * POOL.apy) / 100 / (365 * 24 * 3600)) * (TICK_MS / 1000) * 1000) / s.btcPrice
      : 0;
  if (accrued) setState({ rewardsBtc: s.rewardsBtc + accrued });
  const cr = crOf(collateral, debt, s.btcPrice);
  if (!isFinite(cr) || cr >= s.shield.trigger) return;
  if (s.shield.enabled && pool > 0) {
    // Repay enough to restore CR to trigger + 15 points.
    const target = s.shield.trigger + 15;
    const need = Math.max(0, debt - (collateral * s.btcPrice * 100) / target);
    const a = Math.min(pool, need);
    if (a > 0) {
      setState({ position: { collateral, debt: debt - a, pool: pool - a } });
      logActivity("shield_repay", a, "MUSD", `Shield triggered at ${cr.toFixed(0)}% CR`);
    }
  }
  if (
    s.shield.alerts &&
    Date.now() - lastAlert > 60_000 &&
    typeof Notification !== "undefined" &&
    Notification.permission === "granted"
  ) {
    lastAlert = Date.now();
    new Notification("MezoFlow: Trove at risk", {
      body: `Collateral ratio is ${cr.toFixed(0)}%, below your ${s.shield.trigger}% shield trigger.`,
    });
  }
}

/** Simulated live BTC price feed with gentle random walk; also drives reward accrual and the shield. */
export function usePriceFeed(live: boolean) {
  const [, f] = useState(0);
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => {
      const p = getState().btcPrice * (1 + (Math.random() - 0.5) * 0.004);
      setState({ btcPrice: Math.round(p) });
      simTick();
      f((x) => x + 1);
    }, TICK_MS);
    return () => clearInterval(t);
  }, [live]);
}

export const sats = (btc: number) => Math.round(btc * 1e8).toLocaleString("en-US");
