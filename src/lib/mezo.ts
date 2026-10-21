import { useEffect, useState, useSyncExternalStore } from "react";
import { walletSwitchViaAdapter } from "./wallet-adapter";

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
export const SAFE_CR = 150; // healthy buffer shown by the planner

export type Invoice = {
  id: string;
  amount: number;
  description: string;
  recipient: string;
  paid?: boolean | undefined;
  tx?: string | undefined;
};
export type ActivityKind =
  | "transfer"
  | "router_pay"
  | "approve"
  | "invoice_paid"
  // Kept so older saved lists still read; the app only records new payments.
  | "borrow"
  | "add_collateral"
  | "withdraw_collateral"
  | "repay"
  | "pool_deposit"
  | "pool_withdraw"
  | "claim_rewards"
  | "compound_rewards"
  | "invoice_created"
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
type State = {
  account: string | null;
  chainId: number | null;
  btcPrice: number;
  priceLive: boolean;
  invoices: Invoice[];
  activity: Activity[];
  /** Last wallet this browser was connected with, for a one-tap reconnect. */
  lastWallet: string | null;
};

let state: State = {
  account: null,
  chainId: null,
  btcPrice: 0,
  priceLive: false,
  invoices: [],
  activity: [],
  lastWallet: null,
};
const subs = new Set<() => void>();
const emit = () => {
  subs.forEach((s) => s());
  if (typeof window !== "undefined")
    localStorage.setItem(
      "mezoflow",
      JSON.stringify({
        invoices: state.invoices,
        activity: state.activity,
      }),
    );
};
export function setState(p: Partial<State>) {
  state = { ...state, ...p };
  if (typeof window !== "undefined" && p.account !== undefined) {
    if (p.account) localStorage.setItem("mezoflow_last_wallet", p.account);
    else localStorage.removeItem("mezoflow_last_wallet");
    state.lastWallet = p.account ?? null;
  }
  emit();
}
export function getState() {
  return state;
}

/** Records a payment broadcast through the wallet. Only real receipts are listed. */
export function logActivity(
  kind: ActivityKind,
  amount: number,
  unit: "BTC" | "MUSD",
  note?: string,
  tx?: string,
) {
  if (!tx) return "";
  const entry: Activity = {
    id: tx.slice(2, 14),
    ts: Date.now(),
    kind,
    amount,
    unit,
    status: "confirmed",
    tx,
    note,
    onchain: true,
  };
  setState({ activity: [entry, ...state.activity].slice(0, 500) });
  return tx;
}

/** Correct a payment's state once the network confirms it. */
export function setActivityStatus(tx: string, status: "confirmed" | "failed") {
  setState({
    activity: state.activity.map((a) => (a.tx === tx ? { ...a, status } : a)),
  });
}
let loaded = false;
export function hydrateStore() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem("mezoflow");
    if (raw) {
      const saved = JSON.parse(raw) as Partial<State> & {
        position?: unknown;
        rewardsBtc?: unknown;
        shield?: unknown;
      };
      const activity = Array.isArray(saved.activity)
        ? (saved.activity as Activity[]).filter((a) => a && a.onchain && typeof a.tx === "string")
        : [];
      const knownTx = new Set(activity.map((a) => a.tx));
      const invoices = Array.isArray(saved.invoices)
        ? (saved.invoices as Invoice[]).map((i) =>
            i.paid && i.tx && !knownTx.has(i.tx) ? { ...i, paid: false, tx: undefined } : i,
          )
        : [];
      state = { ...state, invoices, activity };
    }
  } catch {
    // Corrupted persist is ignored; state stays at defaults.
  }
  try {
    const last = localStorage.getItem("mezoflow_last_wallet");
    if (last && /^0x[0-9a-fA-F]{40}$/.test(last)) state = { ...state, lastWallet: last };
  } catch {
    // Storage unavailable: reconnect button simply stays hidden.
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

/** Live Bitcoin price in USD. Tries two free feeds; returns 0 when offline. */
export async function fetchBtcPrice(): Promise<number> {
  const pick = (v: unknown): number => {
    const n = typeof v === "string" ? Number(v) : (v as number);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  try {
    const r = await fetch("https://api.coinbase.com/v2/prices/BTC-USD/spot");
    if (r.ok) {
      const j = (await r.json()) as { data?: { amount?: string } };
      const p = pick(j.data?.amount);
      if (p) return p;
    }
  } catch {
    // Fall through to the backup feed.
  }
  try {
    const r = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
    );
    if (r.ok) {
      const j = (await r.json()) as { bitcoin?: { usd?: number } };
      const p = pick(j.bitcoin?.usd);
      if (p) return p;
    }
  } catch {
    // Offline: keep the last known price.
  }
  return 0;
}

/** Live BTC price, refreshed every minute while mounted. */
export function usePriceFeed(live: boolean) {
  const [, f] = useState(0);
  useEffect(() => {
    if (!live || typeof window === "undefined") return;
    let stop = false;
    const load = async () => {
      const p = await fetchBtcPrice();
      if (!stop && p > 0) {
        setState({ btcPrice: Math.round(p), priceLive: true });
        f((x) => x + 1);
      }
    };
    void load();
    const t = setInterval(load, 60_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [live]);
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

/** The wallet actually in use, once we know which one has the account. */
let activeProvider: Eth | null = null;

/** Every wallet installed in this browser, via EIP-6963 plus the older single-provider slot. */
function installedWallets(): Eth[] {
  if (typeof window === "undefined") return [];
  const found: Eth[] = [];
  const seen = new Set<Eth>();
  const onAnnounce = (ev: Event) => {
    const p = (ev as CustomEvent<{ provider?: Eth }>).detail?.provider;
    if (p && !seen.has(p)) {
      seen.add(p);
      found.push(p);
    }
  };
  window.addEventListener("eip6963:announceProvider", onAnnounce);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  window.removeEventListener("eip6963:announceProvider", onAnnounce);
  const legacy = (window as unknown as { ethereum?: Eth & { providers?: Eth[] } }).ethereum;
  for (const p of legacy?.providers ?? []) {
    if (!seen.has(p)) {
      seen.add(p);
      found.push(p);
    }
  }
  if (legacy && !seen.has(legacy)) found.push(legacy);
  return found;
}

const eth = (): Eth | undefined => {
  if (typeof window === "undefined") return undefined;
  return activeProvider ?? (window as unknown as { ethereum?: Eth }).ethereum;
};

let watching = false;
function watchWallet(e: Eth) {
  if (watching) return;
  watching = true;
  e.on?.("accountsChanged", (a: unknown) => setState({ account: (a as string[])[0] ?? null }));
  e.on?.("chainChanged", (c: unknown) => setState({ chainId: parseInt(c as string, 16) }));
}

/**
 * Quietly reconnect on page load using accounts the wallet already approved.
 * Checks every installed wallet, so it works even with several installed.
 * No popup: eth_accounts only returns accounts the user already shared.
 */
export async function restoreWallet() {
  const wallets = installedWallets();
  for (const p of wallets) {
    try {
      const accounts = (await p.request({ method: "eth_accounts" })) as string[];
      const first = accounts?.[0];
      if (!first) continue;
      activeProvider = p;
      watchWallet(p);
      const cid = parseInt((await p.request({ method: "eth_chainId" })) as string, 16);
      setState({ account: first, chainId: cid });
      return true;
    } catch {
      // This wallet refused; try the next one.
    }
  }
  return false;
}

/**
 * Reconnect quietly on page load, retrying briefly in case the wallet
 * extension is still starting up. Never shows a popup.
 */
export function autoRestore() {
  let tries = 0;
  const attempt = async () => {
    tries += 1;
    const ok = (await restoreWallet()) || Boolean(getState().account);
    if (ok || tries >= 8) {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    }
  };
  const onFocus = () => void attempt();
  const timer = window.setInterval(() => void attempt(), 1500);
  window.addEventListener("focus", onFocus);
  void attempt();
}

export async function connectWallet() {
  const e = eth() ?? installedWallets()[0];
  if (!e) throw new Error("No browser wallet found. Install MetaMask or another EVM wallet.");
  activeProvider = e;
  const [acc] = (await e.request({ method: "eth_requestAccounts" })) as string[];
  const cid = parseInt((await e.request({ method: "eth_chainId" })) as string, 16);
  setState({ account: acc ?? null, chainId: cid });
  watchWallet(e);
}

export async function switchToMezo() {
  if (await walletSwitchViaAdapter(MEZO.chainId)) {
    setState({ chainId: MEZO.chainId });
    return;
  }
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

export const sats = (btc: number) => Math.round(btc * 1e8).toLocaleString("en-US");
