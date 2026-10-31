/**
 * On-chain layer. Wallet chain constants live in `src/lib/mezo.ts` (`MEZO`).
 * Token and contract addresses live here so wording changes never switch
 * networks. Reads use the browser wallet when one is installed and the
 * public Mezo RPC otherwise; writes open the connected wallet.
 */

import {
  INVOICE_PAID_ABI,
  TRANSFER_ABI,
  decodeInvoicePaid,
  decodeTransfer,
  type BillPaid,
  type DirectPaid,
  type RawLog,
} from "./bills";
import { getWalletAdapter } from "./wallet-adapter";

export const MUSD_TOKEN = {
  /** Mezo mainnet MUSD (18 decimals). */
  mainnet: "0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186",
  /** Mezo testnet MUSD (18 decimals). */
  testnet: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503",
  decimals: 18,
} as const;

/**
 * MEZO coin addresses. Values resolve from `VITE_MEZO_TOKEN_*` when set,
 * otherwise empty and the balance simply shows — .
 */
const envText = (k: string): string | null => {
  try {
    const v = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[k];
    return v?.trim() || null;
  } catch {
    return null;
  }
};

const env = (k: string): string | null => {
  const v = envText(k);
  return v && /^0x[0-9a-fA-F]{40}$/.test(v) ? v : null;
};

const envInt = (k: string): number | null => {
  const v = envText(k);
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export const MEZO_TOKEN = {
  mainnet: env("VITE_MEZO_TOKEN_MAINNET"),
  testnet: env("VITE_MEZO_TOKEN_TESTNET"),
  decimals: 18,
} as const;

export const SUPPORTED_CHAINS = [
  { id: 31611, label: "Mezo Testnet", musd: MUSD_TOKEN.testnet, mezoToken: MEZO_TOKEN.testnet },
  { id: 31612, label: "Mezo Mainnet", musd: MUSD_TOKEN.mainnet, mezoToken: MEZO_TOKEN.mainnet },
  { id: 1, label: "Ethereum", musd: null, mezoToken: null },
  { id: 8453, label: "Base", musd: null, mezoToken: null },
  { id: 56, label: "BNB Chain", musd: null, mezoToken: null },
] as const;

export function musdAddressFor(chainId: number | null): string | null {
  if (chainId === 31611) return MUSD_TOKEN.testnet;
  if (chainId === 31612) return MUSD_TOKEN.mainnet;
  return null;
}

export function mezoTokenAddressFor(chainId: number | null): string | null {
  if (chainId === 31611) return MEZO_TOKEN.testnet;
  if (chainId === 31612) return MEZO_TOKEN.mainnet;
  return null;
}

// ---------------------------------------------------------------------------
// Minimal ERC-20 encoding (no viem/ethers dependency)
// ---------------------------------------------------------------------------

function strip0x(h: string) {
  return h.startsWith("0x") ? h.slice(2) : h;
}

function pad32(hexNoPrefix: string) {
  return hexNoPrefix.toLowerCase().padStart(64, "0");
}

function addrToWord(addr: string) {
  return pad32(strip0x(addr));
}

const SEL = {
  balanceOf: "70a08231",
  transfer: "a9059cbb",
  decimals: "313ce567",
} as const;

function uintToWord(v: bigint) {
  return pad32(v.toString(16));
}

export function parseMUSD(amount: number | string): bigint {
  const s = String(amount);
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error("Invalid MUSD amount.");
  const parts = s.split(".");
  const w = parts[0] ?? "0";
  const f = parts[1] ?? "";
  const frac = `${f}${"0".repeat(18)}`.slice(0, 18);
  return BigInt(w === "" ? "0" : w) * 10n ** 18n + BigInt(frac === "" ? "0" : frac);
}

export function formatMUSD(wei: bigint, dp = 2): string {
  const neg = wei < 0n;
  const v = neg ? -wei : wei;
  const w = v / 10n ** 18n;
  const f = (v % 10n ** 18n).toString().padStart(18, "0").slice(0, dp).padEnd(dp, "0");
  return `${neg ? "-" : ""}${w.toLocaleString("en-US")}.${f}`;
}

function decodeUint256(hex: string): bigint {
  const h = strip0x(hex);
  if (h.length === 0) throw new Error("Empty response.");
  return BigInt(`0x${h.slice(-64)}`);
}

type EthProvider = {
  request: (a: { method: string; params?: unknown }) => Promise<unknown>;
};

function provider(): EthProvider | null {
  if (typeof window === "undefined") return null;
  const connected = getWalletAdapter()?.request;
  if (connected) return { request: connected };
  const e = (window as unknown as { ethereum?: EthProvider }).ethereum;
  return e ?? null;
}

/** Public read endpoint used when no browser wallet is present. */
const READ_RPC = "https://rpc.test.mezo.org";

const RPC_BY_CHAIN: Record<number, string> = {
  31611: READ_RPC,
  31612: "https://rpc.mainnet.mezo.org",
};

async function rpcCallTo(url: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`Network read failed (${res.status}).`);
  const j = (await res.json()) as { result?: unknown; error?: { message?: string } };
  if (j.error) throw new Error(j.error.message ?? "Network read failed.");
  return j.result;
}

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  return rpcCallTo(READ_RPC, method, params);
}

async function ethCall(to: string, data: string): Promise<string> {
  const e = provider();
  if (e)
    return (await e.request({ method: "eth_call", params: [{ to, data }, "latest"] })) as string;
  return (await rpcCall("eth_call", [{ to, data }, "latest"])) as string;
}

/** Read from a known network without depending on the wallet's current chain. */
async function ethCallTo(chainId: number, to: string, data: string): Promise<string> {
  const url = RPC_BY_CHAIN[chainId];
  if (!url) throw new Error("This network is not supported.");
  return (await rpcCallTo(url, "eth_call", [{ to, data }, "latest"])) as string;
}

/** Real read: ERC-20 MUSD balance for `account` on the wallet's chain. */
export async function getMusdBalance(account: string, musd: string): Promise<number> {
  const data = `0x${SEL.balanceOf}${addrToWord(account)}`;
  const raw = await ethCall(musd, data);
  const wei = decodeUint256(raw);
  return Number(wei) / 1e18;
}

/** Real read: MEZO token balance. Returns null when no token is configured for the chain. */
export async function getMezoTokenBalance(
  account: string,
  token: string | null,
): Promise<number | null> {
  if (!token) return null;
  const data = `0x${SEL.balanceOf}${addrToWord(account)}`;
  const raw = await ethCall(token, data);
  return Number(decodeUint256(raw)) / 1e18;
}

/** Real read: Bitcoin (the native coin on Mezo) in the connected wallet. */
export async function getBtcBalanceWei(account: string): Promise<bigint> {
  const e = provider();
  const hex = e
    ? ((await e.request({ method: "eth_getBalance", params: [account, "latest"] })) as string)
    : ((await rpcCall("eth_getBalance", [account, "latest"])) as string);
  return BigInt(hex);
}

/** Real read: Bitcoin (the native coin on Mezo) in the connected wallet. */
export async function getBtcBalance(account: string): Promise<number> {
  return Number(await getBtcBalanceWei(account)) / 1e18;
}

export async function getChainId(): Promise<number> {
  const e = provider();
  if (!e) throw new Error("No browser wallet found.");
  const hex = (await e.request({ method: "eth_chainId" })) as string;
  return parseInt(hex, 16);
}

export async function getBlockNumber(): Promise<bigint> {
  const e = provider();
  const hex = e
    ? ((await e.request({ method: "eth_blockNumber" })) as string)
    : ((await rpcCall("eth_blockNumber", [])) as string);
  return BigInt(hex);
}

// ---------------------------------------------------------------------------
// Mezo protocol reads: the official PriceFeed and TroveManager
// ---------------------------------------------------------------------------

export const MEZO_PROTOCOL = {
  /** Mezo test network (31611). */
  31611: {
    priceFeed: "0x86bCF0841622a5dAC14A313a15f96A95421b9366",
    borrowerOperations: "0xCdF7028ceAB81fA0C6971208e83fa7872994beE5",
    troveManager: "0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0",
  },
  /** Mezo mainnet (31612). */
  31612: {
    priceFeed: "0xc5aC5A8892230E0A3e1c473881A2de7353fFcA88",
    borrowerOperations: "0x44b1bac67dDA612a41a58AAf779143B181dEe031",
    troveManager: "0x94AfB503dBca74aC3E4929BACEeDfCe19B93c193",
  },
} as const;

export type MezoProtocol = (typeof MEZO_PROTOCOL)[keyof typeof MEZO_PROTOCOL];

export function mezoProtocolFor(chainId: number | null): MezoProtocol | null {
  if (chainId === 31611 || chainId === 31612) return MEZO_PROTOCOL[chainId];
  return null;
}

const MEZO_ABI = [
  {
    name: "fetchPrice",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "getTroveStatus",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_borrower", type: "address" }],
    outputs: [{ type: "uint8" }],
  },
  {
    name: "getEntireDebtAndColl",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_borrower", type: "address" }],
    outputs: [
      { name: "coll", type: "uint256" },
      { name: "principal", type: "uint256" },
      { name: "interest", type: "uint256" },
      { name: "pendingCollateral", type: "uint256" },
      { name: "pendingPrincipal", type: "uint256" },
      { name: "pendingInterest", type: "uint256" },
    ],
  },
  {
    name: "getCurrentICR",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "_borrower", type: "address" },
      { name: "_price", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "getTroveInterestRate",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_borrower", type: "address" }],
    outputs: [{ type: "uint16" }],
  },
  {
    name: "getEntireSystemColl",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "getEntireSystemDebt",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "getTCR",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_price", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "getTroveOwnersCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

async function mezoCall<T>(
  chainId: number,
  contract: string,
  functionName: string,
  args: unknown[] = [],
): Promise<T> {
  const { encodeFunctionData, decodeFunctionResult } = await import("viem");
  const data = encodeFunctionData({
    abi: MEZO_ABI,
    functionName: functionName as "fetchPrice",
    args: args as never,
  });
  const raw = await ethCallTo(chainId, contract, data);
  return decodeFunctionResult({
    abi: MEZO_ABI,
    functionName: functionName as "fetchPrice",
    data: raw as `0x${string}`,
  }) as T;
}

export type MezoSystem = {
  price: bigint;
  totalCollateral: bigint;
  totalDebt: bigint;
  tcr: bigint;
  troveCount: number;
};

/** Real totals from Mezo's TroveManager and PriceFeed. Null when unavailable. */
export async function getMezoSystem(chainId: number): Promise<MezoSystem | null> {
  const p = mezoProtocolFor(chainId);
  if (!p) return null;
  try {
    const price = await mezoCall<bigint>(chainId, p.priceFeed, "fetchPrice");
    const [totalCollateral, totalDebt, tcr, count] = await Promise.all([
      mezoCall<bigint>(chainId, p.troveManager, "getEntireSystemColl"),
      mezoCall<bigint>(chainId, p.troveManager, "getEntireSystemDebt"),
      mezoCall<bigint>(chainId, p.troveManager, "getTCR", [price]),
      mezoCall<bigint>(chainId, p.troveManager, "getTroveOwnersCount"),
    ]);
    return { price, totalCollateral, totalDebt, tcr, troveCount: Number(count) };
  } catch {
    return null;
  }
}

export type MezoTrove = {
  collateral: bigint;
  principal: bigint;
  interest: bigint;
  debt: bigint;
  /** 1e18 = 100%. */
  ratio: bigint;
  /** Mezo's yearly rate in basis points. */
  rate: number;
};

/** A wallet's real Mezo trove. Null when it has no open trove. */
export async function getMezoTrove(chainId: number, who: string): Promise<MezoTrove | null> {
  const p = mezoProtocolFor(chainId);
  if (!p) return null;
  try {
    const status = await mezoCall<number>(chainId, p.troveManager, "getTroveStatus", [who]);
    if (Number(status) !== 1) return null;
    const price = await mezoCall<bigint>(chainId, p.priceFeed, "fetchPrice");
    const [amounts, ratio, rate] = await Promise.all([
      mezoCall<[bigint, bigint, bigint, bigint, bigint, bigint]>(
        chainId,
        p.troveManager,
        "getEntireDebtAndColl",
        [who],
      ),
      mezoCall<bigint>(chainId, p.troveManager, "getCurrentICR", [who, price]),
      mezoCall<number>(chainId, p.troveManager, "getTroveInterestRate", [who]),
    ]);
    return {
      collateral: amounts[0],
      principal: amounts[1],
      interest: amounts[2],
      debt: amounts[1] + amounts[2],
      ratio,
      rate: Number(rate),
    };
  } catch {
    return null;
  }
}

export type TxReceipt = { status: string; blockNumber: string } | null;

/** Read a payment receipt. Empty until the network confirms it. */
export async function getTxReceipt(txHash: string): Promise<TxReceipt> {
  try {
    const e = provider();
    const r = e
      ? ((await e.request({
          method: "eth_getTransactionReceipt",
          params: [txHash],
        })) as TxReceipt)
      : ((await rpcCall("eth_getTransactionReceipt", [txHash])) as TxReceipt);
    return r ?? null;
  } catch {
    return null;
  }
}

/** Wait until a payment is confirmed. Empty when it takes too long. */
export async function waitForReceipt(txHash: string, timeoutMs = 120000): Promise<TxReceipt> {
  const start = Date.now();
  for (;;) {
    const r = await getTxReceipt(txHash);
    if (r && r.blockNumber) return r;
    if (Date.now() - start > timeoutMs) return r;
    await new Promise((res) => setTimeout(res, 2500));
  }
}

/** True = went through, false = went wrong, empty = still unknown. */
export async function didSucceed(txHash: string): Promise<boolean | null> {
  try {
    const r = await waitForReceipt(txHash);
    if (!r) return null;
    return r.status === "0x1";
  } catch {
    return null;
  }
}

/** Send one wallet transaction: through the global wallet kit, or the browser wallet. */
async function sendTx(tx: {
  from: string;
  to: string;
  data: string;
  value?: string;
}): Promise<string> {
  const a = getWalletAdapter();
  if (a) return a.sendTransaction(tx);
  const e = provider();
  if (!e) throw new Error("No browser wallet found.");
  return (await e.request({ method: "eth_sendTransaction", params: [tx] })) as string;
}

/**
 * Real write: ERC-20 MUSD `transfer` through the connected wallet.
 * Returns the receipt hash.
 */
export async function sendMusd(
  to: string,
  amountMusd: number | string,
  musd: string,
  from: string,
): Promise<string> {
  if (!/^0x[0-9a-fA-F]{40}$/.test(to)) throw new Error("Invalid recipient address.");
  const value = parseMUSD(amountMusd);
  if (value <= 0n) throw new Error("Amount must be above zero.");
  const data = `0x${SEL.transfer}${addrToWord(to)}${uintToWord(value)}`;
  return sendTx({ from, to: musd, data });
}

// ---------------------------------------------------------------------------
// InvoiceRouter — the payment contract (`contracts/InvoiceRouter.sol`)
// ---------------------------------------------------------------------------

export type Invoice712 = {
  id: string;
  amount: number;
  to: string;
  desc: string;
  deadline: number;
  nonce: string;
};

export function invoiceTypedData(chainId: number, verifyingContract: string, inv: Invoice712) {
  // Amount is signed in the smallest unit so it matches the on-chain value.
  const amountWei = parseMUSD(inv.amount).toString();
  return {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      Invoice: [
        { name: "id", type: "string" },
        { name: "amount", type: "uint256" },
        { name: "to", type: "address" },
        { name: "desc", type: "string" },
        { name: "deadline", type: "uint256" },
        { name: "nonce", type: "string" },
      ],
    },
    primaryType: "Invoice",
    domain: { name: "MezoFlow", version: "1", chainId, verifyingContract },
    message: { ...inv, amount: amountWei },
  };
}

/**
 * Wallet signature for one exact bill, checked by the payment contract.
 * The signed amount matches the on-chain amount below.
 */
export async function signInvoice712(
  account: string,
  chainId: number,
  verifyingContract: string,
  inv: Invoice712,
): Promise<string> {
  const typed = invoiceTypedData(chainId, verifyingContract, inv);
  const a = getWalletAdapter();
  if (a) return a.signTypedData(account, typed);
  const e = provider();
  if (!e) throw new Error("No browser wallet found.");
  const sig = (await e.request({
    method: "eth_signTypedData_v4",
    params: [account, JSON.stringify(typed)],
  })) as string;
  return sig;
}

// ---------------------------------------------------------------------------
// FlowVault — our own lending pool (`contracts/FlowVault.sol`)
// ---------------------------------------------------------------------------

export function routerAddressFor(chainId: number | null): string | null {
  if (chainId === 31611)
    return env("VITE_ROUTER_ADDRESS_TESTNET") ?? "0x99A9554C090C206a3811604448E5a29CAaB00d45";
  if (chainId === 31612) return env("VITE_ROUTER_ADDRESS_MAINNET");
  return null;
}

/** First block worth reading. Testnet defaults to the payment contract's deploy block. */
export function flowStartBlock(chainId: number): number {
  if (chainId === 31611) return envInt("VITE_FLOW_START_BLOCK_TESTNET") ?? 16173807;
  if (chainId === 31612) return envInt("VITE_FLOW_START_BLOCK_MAINNET") ?? 0;
  return 0;
}

/**
 * The public RPC refuses log queries over 10,000 blocks, so walk the chain in
 * windows and remember what was already read. The first check is a handful of
 * calls; later 30-second ticks only ask for new blocks.
 */
const LOG_CHUNK = 9_000;
type LogCache = { to: number; logs: RawLog[] };
const logCache = new Map<string, LogCache>();
const logInflight = new Map<string, Promise<RawLog[]>>();

async function getLogs(
  chainId: number,
  address: string,
  topics: (string | string[] | null)[],
  key: string,
): Promise<RawLog[]> {
  const running = logInflight.get(key);
  if (running) return running;
  const task = readLogs(chainId, address, topics, key).finally(() => logInflight.delete(key));
  logInflight.set(key, task);
  return task;
}

async function readLogs(
  chainId: number,
  address: string,
  topics: (string | string[] | null)[],
  key: string,
): Promise<RawLog[]> {
  const url = RPC_BY_CHAIN[chainId];
  if (!url) return [];
  const cached = logCache.get(key);
  const logs = cached ? [...cached.logs] : [];
  let from = cached ? cached.to + 1 : flowStartBlock(chainId);
  const headRaw = await rpcCallTo(url, "eth_blockNumber", []);
  const head = typeof headRaw === "string" ? Number.parseInt(headRaw, 16) : Number(headRaw);
  if (!Number.isFinite(head) || from > head) return logs;
  for (; from <= head; from += LOG_CHUNK) {
    const to = Math.min(from + LOG_CHUNK - 1, head);
    const result = await rpcCallTo(url, "eth_getLogs", [
      {
        address,
        topics,
        fromBlock: `0x${from.toString(16)}`,
        toBlock: `0x${to.toString(16)}`,
      },
    ]);
    if (Array.isArray(result)) logs.push(...(result as RawLog[]));
  }
  logCache.set(key, { to: head, logs });
  return logs;
}

/**
 * Real receipts for bills paid through the payment contract. Pass the bill id
 * hashes to reconcile saved bills, or `to` to see money that came to a wallet.
 * Newest first.
 */
export async function getInvoicePaidEvents(
  chainId: number,
  opts: { to?: string; idHashes?: string[] } = {},
): Promise<BillPaid[]> {
  const router = routerAddressFor(chainId);
  if (!router) return [];
  // Never scan a public chain from genesis; set a start block after a deploy.
  if (flowStartBlock(chainId) === 0 && chainId === 31612) return [];
  const { encodeEventTopics } = await import("viem");
  const [topic0] = encodeEventTopics({ abi: INVOICE_PAID_ABI, eventName: "InvoicePaid" });
  if (!topic0) return [];
  const logs = await getLogs(chainId, router, [topic0], `invoice:${chainId}:${router}`);
  const ids = opts.idHashes?.map((h) => h.toLowerCase());
  const to = opts.to?.toLowerCase();
  return logs
    .map(decodeInvoicePaid)
    .filter(
      (e) => (!ids || ids.includes(e.idHash.toLowerCase())) && (!to || e.to.toLowerCase() === to),
    )
    .reverse();
}

/** MUSD sent straight to a wallet, so the same list can show both ways of paying. */
export async function getIncomingMusdTransfers(
  chainId: number,
  account: string,
): Promise<DirectPaid[]> {
  const musd = musdAddressFor(chainId);
  if (!musd) return [];
  // Never scan a public chain from genesis; set a start block after a deploy.
  if (flowStartBlock(chainId) === 0 && chainId === 31612) return [];
  const { encodeEventTopics } = await import("viem");
  const [topic0] = encodeEventTopics({ abi: TRANSFER_ABI, eventName: "Transfer" });
  if (!topic0) return [];
  const who = account.toLowerCase();
  const topics: (string | string[] | null)[] = [topic0, null, `0x${addrToWord(account)}`];
  const logs = await getLogs(chainId, musd, topics, `transfer:${chainId}:${musd}:${who}`);
  return logs
    .map(decodeTransfer)
    .filter((t): t is DirectPaid => t !== null)
    .reverse();
}

const ERC20_APPROVE_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

const ROUTER_ABI = [
  {
    name: "payInvoice",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "inv",
        type: "tuple",
        components: [
          { name: "payer", type: "address" },
          { name: "id", type: "string" },
          { name: "amount", type: "uint256" },
          { name: "to", type: "address" },
          { name: "desc", type: "string" },
          { name: "deadline", type: "uint256" },
          { name: "nonce", type: "string" },
        ],
      },
      { name: "sig", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

/** Approve the router to pull MUSD (one-time per amount). Returns tx hash. */
export async function approveRouter(
  musd: string,
  router: string,
  amountMusd: number | string,
  from: string,
): Promise<string> {
  const { encodeFunctionData } = await import("viem");
  const data = encodeFunctionData({
    abi: ERC20_APPROVE_ABI,
    functionName: "approve",
    args: [router as `0x${string}`, parseMUSD(amountMusd)],
  });
  return sendTx({ from, to: musd, data });
}

export type RouterPayment = {
  payer: string;
  id: string;
  amount: number | string;
  to: string;
  desc: string;
  deadline: number;
  nonce: string;
  sig: string;
};

/** Submit a signed invoice to `InvoiceRouter.payInvoice`. Returns tx hash. */
export async function payViaRouter(
  router: string,
  p: RouterPayment,
  from: string,
): Promise<string> {
  const { encodeFunctionData } = await import("viem");
  const data = encodeFunctionData({
    abi: ROUTER_ABI,
    functionName: "payInvoice",
    args: [
      {
        payer: p.payer as `0x${string}`,
        id: p.id,
        amount: parseMUSD(p.amount),
        to: p.to as `0x${string}`,
        desc: p.desc,
        deadline: BigInt(p.deadline),
        nonce: p.nonce,
      },
      p.sig as `0x${string}`,
    ],
  });
  return sendTx({ from, to: router, data });
}

// ---------------------------------------------------------------------------
// FlowVault — our own lending pool (`contracts/FlowVault.sol`)
// ---------------------------------------------------------------------------

/**
 * The first testnet pool used an owner-set price and an older ABI. Reading it
 * with this app's calls would show broken numbers, so treat it as "no pool".
 */
const LEGACY_VAULT_TESTNET = "0x241af24502bD8DC163c1163Cdb35E9845510544f";

export function vaultAddressFor(chainId: number | null): string | null {
  if (chainId === 31611) {
    const configured = env("VITE_VAULT_ADDRESS_TESTNET");
    if (!configured || configured.toLowerCase() === LEGACY_VAULT_TESTNET.toLowerCase()) return null;
    return configured;
  }
  if (chainId === 31612) return env("VITE_VAULT_ADDRESS_MAINNET");
  return null;
}

const VAULT_ABI = [
  {
    name: "loans",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "backing", type: "uint256" },
      { name: "principal", type: "uint256" },
      { name: "owed", type: "uint256" },
      { name: "tier", type: "uint256" },
      { name: "updated", type: "uint256" },
    ],
  },
  {
    name: "shares",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "owedOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "who", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "backingRatio",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "who", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "poolOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "who", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "cash",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "totalAssets",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "totalLent",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "totalShares",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "btcPrice",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "priceFeed",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    name: "lend",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    name: "unlend",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "n", type: "uint256" }],
    outputs: [],
  },
  {
    name: "openLoan",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "tier", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "addBacking",
    type: "function",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  {
    name: "repay",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    name: "takeBacking",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "backing", type: "uint256" }],
    outputs: [],
  },
  {
    name: "closeLoan",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "who", type: "address" }],
    outputs: [],
  },
] as const;

async function vaultCall<T>(vault: string, functionName: string, args: unknown[] = []): Promise<T> {
  const { encodeFunctionData, decodeFunctionResult } = await import("viem");
  const data = encodeFunctionData({
    abi: VAULT_ABI,
    functionName: functionName as "loans",
    args: args as never,
  });
  const raw = await ethCall(vault, data);
  return decodeFunctionResult({
    abi: VAULT_ABI,
    functionName: functionName as "loans",
    data: raw as `0x${string}`,
  }) as T;
}

async function vaultSend(
  vault: string,
  from: string,
  functionName:
    "lend" | "unlend" | "openLoan" | "addBacking" | "repay" | "takeBacking" | "closeLoan",
  args: unknown[],
  value?: bigint,
): Promise<string> {
  const { encodeFunctionData } = await import("viem");
  const data = encodeFunctionData({ abi: VAULT_ABI, functionName, args: args as never });
  const tx: { from: string; to: string; data: string; value?: string } = { from, to: vault, data };
  if (value !== undefined) tx.value = `0x${value.toString(16)}`;
  return sendTx(tx);
}

export type VaultLoan = {
  backing: bigint;
  principal: bigint;
  owed: bigint;
  liveOwed: bigint;
  ratio: bigint;
  tier: number;
};

export type VaultPosition = {
  loan: VaultLoan;
  /** Value of the wallet's shares, including money out on loan. */
  poolValue: bigint;
  /** Cash those shares could take right now, if enough cash is free. */
  cashValue: bigint;
  shares: bigint;
  totalShares: bigint;
  cash: bigint;
  totalAssets: bigint;
  totalLent: bigint;
  price: bigint;
  priceFeed: string;
};

/** Live loan + pool position for one wallet. Amounts are smallest units. */
export async function getVaultPosition(vault: string, who: string): Promise<VaultPosition> {
  const [
    loan,
    liveOwed,
    ratio,
    shares,
    poolValue,
    cash,
    totalAssets,
    totalLent,
    totalShares,
    price,
    priceFeed,
  ] = await Promise.all([
    vaultCall<[bigint, bigint, bigint, bigint, bigint]>(vault, "loans", [who]),
    vaultCall<bigint>(vault, "owedOf", [who]),
    vaultCall<bigint>(vault, "backingRatio", [who]).catch(() => 0n),
    vaultCall<bigint>(vault, "shares", [who]),
    vaultCall<bigint>(vault, "poolOf", [who]),
    vaultCall<bigint>(vault, "cash", []),
    vaultCall<bigint>(vault, "totalAssets", []),
    vaultCall<bigint>(vault, "totalLent", []),
    vaultCall<bigint>(vault, "totalShares", []),
    vaultCall<bigint>(vault, "btcPrice", []).catch(() => 0n),
    vaultCall<string>(vault, "priceFeed", []),
  ]);

  const proRataCash = totalShares === 0n ? 0n : (shares * cash) / totalShares;
  return {
    loan: {
      backing: loan[0],
      principal: loan[1],
      owed: loan[2],
      liveOwed,
      ratio,
      tier: Number(loan[3]),
    },
    poolValue,
    cashValue: proRataCash < poolValue ? proRataCash : poolValue,
    shares,
    totalShares,
    cash,
    totalAssets,
    totalLent,
    price,
    priceFeed,
  };
}

export const vaultLend = (vault: string, from: string, amount: number | string) =>
  vaultSend(vault, from, "lend", [parseMUSD(amount)]);
export const vaultUnlend = (vault: string, from: string, shares: bigint) =>
  vaultSend(vault, from, "unlend", [shares]);
export const vaultOpenLoan = (
  vault: string,
  from: string,
  amount: number | string,
  tier: number,
  btc: number | string,
) => vaultSend(vault, from, "openLoan", [parseMUSD(amount), BigInt(tier)], parseMUSD(btc));
export const vaultAddBacking = (vault: string, from: string, btc: number | string) =>
  vaultSend(vault, from, "addBacking", [], parseMUSD(btc));
export const vaultRepay = (vault: string, from: string, amount: number | string) =>
  vaultSend(vault, from, "repay", [parseMUSD(amount)]);
export const vaultTakeBacking = (vault: string, from: string, btc: number | string) =>
  vaultSend(vault, from, "takeBacking", [parseMUSD(btc)]);
export const vaultCloseLoan = (vault: string, from: string, who: string) =>
  vaultSend(vault, from, "closeLoan", [who]);

/** Pool-wide numbers anyone can read — no wallet needed. */
export type VaultGlobals = {
  cash: bigint;
  totalAssets: bigint;
  totalLent: bigint;
  totalShares: bigint;
  price: bigint;
  priceFeed: string;
};

export async function getVaultGlobals(vault: string): Promise<VaultGlobals> {
  const [cash, totalAssets, totalLent, totalShares, price, priceFeed] = await Promise.all([
    vaultCall<bigint>(vault, "cash", []),
    vaultCall<bigint>(vault, "totalAssets", []),
    vaultCall<bigint>(vault, "totalLent", []),
    vaultCall<bigint>(vault, "totalShares", []),
    vaultCall<bigint>(vault, "btcPrice", []).catch(() => 0n),
    vaultCall<string>(vault, "priceFeed", []),
  ]);
  return { cash, totalAssets, totalLent, totalShares, price, priceFeed };
}
