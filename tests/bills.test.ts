import { describe, expect, it } from "vitest";
import type { Invoice } from "@/lib/mezo";
import {
  applyBillPayments,
  invoiceIdTopic,
  mergeMoneyIn,
  type BillPaid,
  type DirectPaid,
} from "@/lib/bills";

const FROM = "0x1111111111111111111111111111111111111111";
const TO = "0x2222222222222222222222222222222222222222";
const OTHER = "0x3333333333333333333333333333333333333333";
const TX1 = `0x${"a".repeat(64)}`;
const TX2 = `0x${"b".repeat(64)}`;

const invoice = (over: Partial<Invoice> = {}): Invoice => ({
  id: "bill-1",
  amount: 25,
  description: "Design work",
  recipient: TO,
  ...over,
});

const billEvent = (over: Partial<BillPaid> = {}): BillPaid => ({
  idHash: invoiceIdTopic("bill-1"),
  from: FROM,
  to: TO,
  amount: 25,
  desc: "Design work",
  tx: TX1,
  block: 10,
  ...over,
});

describe("bill id topics", () => {
  it("hashes text ids into 32-byte topics", () => {
    const topic = invoiceIdTopic("bill-1");
    expect(topic).toMatch(/^0x[0-9a-f]{64}$/);
    expect(invoiceIdTopic("bill-2")).not.toBe(topic);
    expect(invoiceIdTopic("bill-1")).toBe(topic);
  });
});

describe("applying payment-contract receipts", () => {
  it("marks the bill paid when the id and recipient match", () => {
    const before = invoice();
    const result = applyBillPayments([before], [billEvent()]);
    expect(result.changed).toBe(true);
    expect(result.invoices[0]?.paid).toBe(true);
    expect(result.invoices[0]?.tx).toBe(TX1);
    expect(before.paid).toBeUndefined();
  });

  it("ignores a receipt paid to another wallet", () => {
    const result = applyBillPayments([invoice()], [billEvent({ to: OTHER })]);
    expect(result.changed).toBe(false);
    expect(result.invoices[0]?.paid).toBeUndefined();
  });

  it("leaves bills that were already paid alone", () => {
    const paid = invoice({ paid: true, tx: TX2 });
    const result = applyBillPayments([paid], [billEvent()]);
    expect(result.changed).toBe(false);
    expect(result.invoices[0]?.tx).toBe(TX2);
  });

  it("does not guess when the receipt belongs to another bill", () => {
    const result = applyBillPayments([invoice({ id: "bill-9" })], [billEvent()]);
    expect(result.changed).toBe(false);
  });

  it("does nothing when there are no receipts", () => {
    const invoices = [invoice()];
    const result = applyBillPayments(invoices, []);
    expect(result.changed).toBe(false);
    expect(result.invoices).toBe(invoices);
  });
});

describe("money received", () => {
  const transfer = (over: Partial<DirectPaid> = {}): DirectPaid => ({
    from: FROM,
    to: TO,
    amount: 10,
    tx: TX2,
    block: 12,
    ...over,
  });

  it("keeps one entry when a bill payment also moved MUSD", () => {
    const list = mergeMoneyIn([billEvent()], [transfer({ tx: TX1 })]);
    expect(list).toHaveLength(1);
    expect(list[0]?.source).toBe("bill");
  });

  it("adds direct payments and sorts newest first", () => {
    const list = mergeMoneyIn([billEvent({ block: 10 })], [transfer({ block: 12 })]);
    expect(list).toHaveLength(2);
    expect(list[0]?.source).toBe("direct");
    expect(list[0]?.desc).toBe("Sent straight to your wallet");
    expect(list[1]?.source).toBe("bill");
  });

  it("uses the receipt as the key so lists never duplicate", () => {
    const list = mergeMoneyIn([billEvent()], [transfer()]);
    expect(new Set(list.map((m) => m.key)).size).toBe(list.length);
  });
});
