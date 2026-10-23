import { describe, expect, it } from "vitest";
import { encodeAbiParameters, keccak256, toHex } from "viem";
import {
  applyBillPayments,
  decodeInvoicePaid,
  decodeTransfer,
  invoiceIdTopic,
  mergeMoneyIn,
  type BillPaid,
  type DirectPaid,
  type RawLog,
} from "@/lib/bills";
import type { Invoice } from "@/lib/mezo";

const FROM = "0x1111111111111111111111111111111111111111";
const TO = "0x2222222222222222222222222222222222222222";
const TX = `0x${"c".repeat(64)}`;
const TX2 = `0x${"d".repeat(64)}`;
const ZERO = "0x0000000000000000000000000000000000000000";
const INVOICE_TOPIC = keccak256(toHex("InvoicePaid(string,address,address,uint256,string)"));
const TRANSFER_TOPIC = keccak256(toHex("Transfer(address,address,uint256)"));

const addrTopic = (address: string) => `0x${address.slice(2).toLowerCase().padStart(64, "0")}`;
const wad = (n: number) => BigInt(n) * 10n ** 18n;

function paidLog(over: Partial<RawLog> = {}, amount = wad(10), desc = "Design work"): RawLog {
  return {
    data: encodeAbiParameters([{ type: "uint256" }, { type: "string" }], [amount, desc]),
    topics: [INVOICE_TOPIC, invoiceIdTopic("bill-1"), addrTopic(FROM), addrTopic(TO)],
    transactionHash: TX,
    blockNumber: "0x20",
    ...over,
  };
}

function transferLog(over: Partial<RawLog> = {}, value = wad(5), from = FROM, to = TO): RawLog {
  return {
    data: encodeAbiParameters([{ type: "uint256" }], [value]),
    topics: [TRANSFER_TOPIC, addrTopic(from), addrTopic(to)],
    transactionHash: TX2,
    blockNumber: "0x21",
    ...over,
  };
}

function billEvent(over: Partial<BillPaid> = {}): BillPaid {
  return {
    idHash: invoiceIdTopic("bill-1"),
    from: FROM,
    to: TO,
    amount: 10,
    desc: "Design work",
    tx: TX,
    block: 32,
    ...over,
  };
}

function transferEvent(over: Partial<DirectPaid> = {}): DirectPaid {
  return { from: FROM, to: TO, amount: 5, tx: TX2, block: 33, ...over };
}

describe("reading a paid bill from chain data", () => {
  it("recovers the payer, recipient, amount, note, and block", () => {
    expect(decodeInvoicePaid(paidLog())).toEqual({
      idHash: invoiceIdTopic("bill-1"),
      from: FROM,
      to: TO,
      amount: 10,
      desc: "Design work",
      tx: TX,
      block: 32,
    });
  });

  it("keeps bills separate even when they share a payer", () => {
    const a = decodeInvoicePaid(paidLog());
    const b = decodeInvoicePaid(
      paidLog({
        topics: [INVOICE_TOPIC, invoiceIdTopic("bill-2"), addrTopic(FROM), addrTopic(TO)],
      }),
    );
    expect(a.idHash).not.toBe(b.idHash);
  });

  it("rejects a log from a different event", () => {
    expect(() => decodeInvoicePaid(transferLog())).toThrow();
  });
});

describe("reading a direct MUSD transfer", () => {
  it("returns real money movement", () => {
    expect(decodeTransfer(transferLog())).toEqual({
      from: FROM,
      to: TO,
      amount: 5,
      tx: TX2,
      block: 33,
    });
  });

  it("ignores zero-value and mint transfers", () => {
    expect(decodeTransfer(transferLog({}, 0n))).toBeNull();
    expect(decodeTransfer(transferLog({}, wad(5), ZERO))).toBeNull();
  });
});

describe("marking bills paid", () => {
  const bill: Invoice = {
    id: "bill-1",
    amount: 10,
    description: "Design work",
    recipient: TO,
    paid: false,
  };

  it("marks only the matching bill for the matching recipient", () => {
    const { invoices, changed } = applyBillPayments(
      [bill, { ...bill, id: "bill-2" }, { ...bill, id: "bill-3", recipient: FROM }],
      [billEvent()],
    );

    expect(changed).toBe(true);
    expect(invoices.map((i) => [i.id, i.paid, i.tx])).toEqual([
      ["bill-1", true, TX],
      ["bill-2", false, undefined],
      ["bill-3", false, undefined],
    ]);
  });

  it("matches an address regardless of letter case", () => {
    const { changed } = applyBillPayments(
      [{ ...bill, recipient: TO.toUpperCase().replace("0X", "0x") }],
      [billEvent({ to: TO.toLowerCase() })],
    );
    expect(changed).toBe(true);
  });

  it("leaves an already-paid bill and an empty event list alone", () => {
    const paid: Invoice = { ...bill, paid: true, tx: TX2 };
    expect(applyBillPayments([paid], [billEvent()])).toEqual({ invoices: [paid], changed: false });
    expect(applyBillPayments([bill], [])).toEqual({ invoices: [bill], changed: false });
  });
});

describe("one incoming-money list", () => {
  it("keeps the bill entry when the same receipt also moved MUSD", () => {
    const list = mergeMoneyIn([billEvent()], [transferEvent({ tx: TX })]);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ key: `bill:${TX}`, source: "bill", desc: "Design work" });
  });

  it("keeps direct transfers that were not bill payments", () => {
    const list = mergeMoneyIn([billEvent()], [transferEvent()]);
    expect(list.map((m) => m.source).sort()).toEqual(["bill", "direct"]);
    expect(list.map((m) => m.key)).toContain(`direct:${TX2}`);
  });

  it("sorts newest first", () => {
    const list = mergeMoneyIn(
      [billEvent({ block: 10 })],
      [transferEvent({ block: 40 }), transferEvent({ tx: TX2, block: 20 })],
    );
    expect(list.map((m) => m.block)).toEqual([40, 10]);
    expect(list).toHaveLength(2);
  });
});
