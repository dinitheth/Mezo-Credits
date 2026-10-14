import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/Shell";
import { Btn, Card, Field, cleanNum, inputCls } from "@/components/ui-bits";
import { InvoiceQR } from "@/components/InvoiceQR";
import { getState, logActivity, num, setState, short, useStore } from "@/lib/mezo";

export const Route = createFileRoute("/pay")({
  head: () => ({
    meta: [
      { title: "Instant Pay & Credit Links — MezoFlow" },
      { name: "description", content: "Create MUSD invoices and shareable payment links that payers settle from their BTC credit line." },
      { property: "og:title", content: "Instant Pay with Credit Links — MezoFlow" },
      { property: "og:description", content: "Generate MUSD payment links with Pay-with-Credit checkout on Mezo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pay,
});

function Pay() {
  const s = useStore();
  const [amount, setAmount] = useState("250");
  const [desc, setDesc] = useState("Design services — October");
  const [to, setTo] = useState("");
  const [copied, setCopied] = useState("");
  const valid = Number(amount) > 0 && /^0x[0-9a-fA-F]{40}$/.test(to || s.account || "");

  const create = () => {
    const id = Math.random().toString(36).slice(2, 10);
    const recipient = to || s.account!;
    setState({ invoices: [{ id, amount: Number(amount), description: desc.slice(0, 140), recipient }, ...getState().invoices] });
    logActivity("invoice_created", Number(amount), "MUSD", `Invoice ${id} · to ${short(recipient)}`);
  };
  const link = (i: { id: string; amount: number; description: string; recipient: string }) =>
    `${typeof window === "undefined" ? "" : window.location.origin}/checkout?id=${i.id}&amount=${i.amount}&to=${i.recipient}&desc=${encodeURIComponent(i.description)}`;

  return (
    <Shell>
      <h1 className="text-3xl font-bold">Instant Pay</h1>
      <p className="mt-2 text-muted-foreground">Bill in MUSD. Payers can settle from their wallet or tap their BTC credit line in one step.</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <Field label="Amount (MUSD)"><input className={inputCls} inputMode="decimal" value={amount} onChange={(e) => setAmount(cleanNum(e.target.value, 2))} /></Field>
          <Field label="Description"><input className={inputCls + " font-sans"} maxLength={140} value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
          <Field label="Recipient address" tip="Mezo address that receives MUSD. Defaults to your connected wallet.">
            <input className={inputCls} placeholder={s.account ?? "0x…"} value={to} onChange={(e) => setTo(e.target.value.trim())} />
          </Field>
          {!valid && <p className="text-xs text-muted-foreground">Enter an amount and a valid 0x address (or connect your wallet).</p>}
          <Btn className="w-full" disabled={!valid} onClick={create}>Generate payment link</Btn>
        </Card>
        <div className="space-y-3">
          <h2 className="font-semibold">Your invoices</h2>
          {s.invoices.length === 0 && <Card className="text-sm text-muted-foreground">No invoices yet.</Card>}
          {s.invoices.map((i) => (
            <Card key={i.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-lg text-success">{num(i.amount, 2)} MUSD</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${i.paid ? "bg-success/20 text-success" : "bg-primary/15 text-primary"}`}>{i.paid ? "Paid" : "Open"}</span>
              </div>
              <p className="text-sm">{i.description}</p>
              <p className="font-mono text-xs text-muted-foreground">to {short(i.recipient)}</p>
              {!i.paid && <InvoiceQR url={link(i)} amount={i.amount} description={i.description} compact />}
              <div className="flex gap-2">
                <Btn variant="ghost" className="py-1.5" onClick={() => { navigator.clipboard.writeText(link(i)); setCopied(i.id); }}>{copied === i.id ? "Copied!" : "Copy link"}</Btn>
                <Link to="/checkout" search={{ id: i.id, amount: i.amount, to: i.recipient, desc: i.description }}><Btn variant="ghost" className="py-1.5">Open checkout</Btn></Link>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </Shell>
  );
}
