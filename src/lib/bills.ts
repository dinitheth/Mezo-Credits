/**
 * Bills are plain requests stored in this browser. Their truth on Mezo comes
 * from `InvoicePaid` events on the payment contract, so the person who asked
 * sees "Paid" even when the payer used another device.
 */
import { decodeEventLog, keccak256, toHex, type Hex } from "viem";

import type { Invoice } from "./mezo";

export const INVOICE_PAID_ABI = [
  {
    type: "event",
    name: "InvoicePaid",
    inputs: [
      { name: "id", type: "string", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "desc", type: "string", indexed: false },
    ],
  },
] as const;

export const TRANSFER_ABI = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
] as const;

export type RawLog = {
  data: string;
  topics: string[];
  transactionHash: string;
  blockNumber: string;
};

export type BillPaid = {
  /** Hash stored in the event topic for the bill's text id. */
  idHash: string;
  from: string;
  to: string;
  amount: number;
  desc: string;
  tx: string;
  block: number;
};

export type DirectPaid = {
  from: string;
  to: string;
  amount: number;
  tx: string;
  block: number;
};

export type MoneyIn = {
  key: string;
  source: "bill" | "direct";
  from: string;
  to: string;
  amount: number;
  desc: string;
  tx: string;
  block: number;
};

const ZERO = "0x0000000000000000000000000000000000000000";

/** Solidity hashes indexed strings with keccak256 over their UTF-8 bytes. */
export function invoiceIdTopic(id: string): string {
  return keccak256(toHex(id));
}

export function decodeInvoicePaid(log: RawLog): BillPaid {
  const { args } = decodeEventLog({
    abi: INVOICE_PAID_ABI,
    eventName: "InvoicePaid",
    data: log.data as Hex,
    topics: log.topics as [Hex, ...Hex[]],
  });
  const a = args as unknown as {
    id: Hex;
    payer: string;
    to: string;
    amount: bigint;
    desc: string;
  };
  return {
    idHash: a.id,
    from: a.payer,
    to: a.to,
    amount: Number(a.amount) / 1e18,
    desc: a.desc,
    tx: log.transactionHash,
    block: Number(log.blockNumber),
  };
}

export function decodeTransfer(log: RawLog): DirectPaid | null {
  const { args } = decodeEventLog({
    abi: TRANSFER_ABI,
    eventName: "Transfer",
    data: log.data as Hex,
    topics: log.topics as [Hex, ...Hex[]],
  });
  const a = args as unknown as { from: string; to: string; value: bigint };
  if (!a.value || a.value === 0n) return null;
  if (a.from.toLowerCase() === ZERO) return null;
  return {
    from: a.from,
    to: a.to,
    amount: Number(a.value) / 1e18,
    tx: log.transactionHash,
    block: Number(log.blockNumber),
  };
}

/**
 * Marks local bills paid when the payment contract has a receipt for that
 * exact bill id, paid to the wallet the bill asked for.
 */
export function applyBillPayments(
  invoices: Invoice[],
  events: BillPaid[],
): { invoices: Invoice[]; changed: boolean } {
  if (!events.length) return { invoices, changed: false };
  const byId = new Map<string, BillPaid>();
  for (const e of events) byId.set(e.idHash.toLowerCase(), e);
  let changed = false;
  const next = invoices.map((i) => {
    if (i.paid) return i;
    const e = byId.get(invoiceIdTopic(i.id).toLowerCase());
    if (!e || e.to.toLowerCase() !== i.recipient.toLowerCase()) return i;
    changed = true;
    return { ...i, paid: true, tx: e.tx };
  });
  return { invoices: changed ? next : invoices, changed };
}

/**
 * One list of money that came in. A router payment also moves MUSD, so the
 * same receipt can appear in both sources; the bill entry wins.
 */
export function mergeMoneyIn(bills: BillPaid[], transfers: DirectPaid[]): MoneyIn[] {
  const byTx = new Map<string, MoneyIn>();
  for (const b of bills) {
    byTx.set(b.tx.toLowerCase(), {
      key: `bill:${b.tx}`,
      source: "bill",
      from: b.from,
      to: b.to,
      amount: b.amount,
      desc: b.desc,
      tx: b.tx,
      block: b.block,
    });
  }
  for (const t of transfers) {
    const key = t.tx.toLowerCase();
    if (byTx.has(key)) continue;
    byTx.set(key, {
      key: `direct:${t.tx}`,
      source: "direct",
      from: t.from,
      to: t.to,
      amount: t.amount,
      desc: "Sent straight to your wallet",
      tx: t.tx,
      block: t.block,
    });
  }
  return [...byTx.values()].sort((a, b) => b.block - a.block);
}
