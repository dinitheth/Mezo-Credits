import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Shell } from "@/components/Shell";
import { Btn, Card, Field, cleanNum, inputCls } from "@/components/ui-bits";
import { InvoiceQR } from "@/components/InvoiceQR";
import { getState, num, setState, short, useStore } from "@/lib/mezo";

export const Route = createFileRoute("/pay")({
  validateSearch: z.object({
    amount: z.coerce.number().optional(),
    desc: z.string().optional(),
  }),
  head: () => ({
    meta: [
      { title: "Ask for money — MezoFlow" },
      {
        name: "description",
        content: "Make MUSD payment links people can pay in one step.",
      },
      { property: "og:title", content: "Ask for money — MezoFlow" },
      {
        property: "og:description",
        content: "Shareable MUSD payment links on Mezo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pay,
});

function Pay() {
  const s = useStore();
  const search = Route.useSearch();
  const startAmount = search.amount && search.amount > 0 ? String(search.amount) : "250";
  const startDesc = search.desc || "Design work — October";
  const [amount, setAmount] = useState(startAmount);
  const [desc, setDesc] = useState(startDesc);
  const [to, setTo] = useState("");
  const [copied, setCopied] = useState("");
  const valid = Number(amount) > 0 && /^0x[0-9a-fA-F]{40}$/.test(to || s.account || "");

  const remove = (id: string) => {
    setState({ invoices: getState().invoices.filter((i) => i.id !== id) });
  };
  const create = () => {
    const id = Math.random().toString(36).slice(2, 10);
    const recipient = to || s.account!;
    setState({
      invoices: [
        { id, amount: Number(amount), description: desc.slice(0, 140), recipient },
        ...getState().invoices,
      ],
    });
  };
  const link = (i: { id: string; amount: number; description: string; recipient: string }) =>
    `${typeof window === "undefined" ? "" : window.location.origin}/checkout?id=${i.id}&amount=${i.amount}&to=${i.recipient}&desc=${encodeURIComponent(i.description)}`;

  return (
    <Shell>
      <h1 className="text-3xl font-bold">Ask for money</h1>
      <p className="mt-2 text-muted-foreground">
        Make a payment link. Share it, and the money lands straight in your wallet.
      </p>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <Field label="Amount in dollars (MUSD)">
            <input
              className={inputCls}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(cleanNum(e.target.value, 2))}
            />
          </Field>
          <Field label="What is it for?">
            <input
              className={inputCls + " font-sans"}
              maxLength={140}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </Field>
          <Field
            label="Send the money to"
            tip="The wallet that gets paid. Empty means your own wallet."
          >
            <input
              className={inputCls}
              placeholder={s.account ?? "0x…"}
              value={to}
              onChange={(e) => setTo(e.target.value.trim())}
            />
          </Field>
          {!valid && (
            <p className="text-xs text-muted-foreground">
              Add an amount. To send to someone else, paste their wallet address.
            </p>
          )}
          <Btn className="w-full" disabled={!valid} onClick={create}>
            Make the link
          </Btn>
        </Card>
        <div className="space-y-3">
          <h2 className="font-semibold">Your links</h2>
          {s.invoices.length === 0 && (
            <Card className="text-sm text-muted-foreground">
              Nothing here yet. Make your first link on the left.
            </Card>
          )}
          {s.invoices.map((i) => (
            <Card key={i.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-lg text-success">{num(i.amount, 2)} MUSD</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${i.paid ? "bg-success/20 text-success" : "bg-primary/15 text-primary"}`}
                >
                  {i.paid ? "Paid" : "Open"}
                </span>
              </div>
              <p className="text-sm">{i.description}</p>
              <p className="font-mono text-xs text-muted-foreground">to {short(i.recipient)}</p>
              {!i.paid && (
                <InvoiceQR url={link(i)} amount={i.amount} description={i.description} compact />
              )}
              <div className="flex gap-2">
                <Btn
                  variant="ghost"
                  className="py-1.5"
                  onClick={() => {
                    navigator.clipboard.writeText(link(i));
                    setCopied(i.id);
                  }}
                >
                  {copied === i.id ? "Copied!" : "Copy link"}
                </Btn>
                <Link
                  to="/checkout"
                  search={{ id: i.id, amount: i.amount, to: i.recipient, desc: i.description }}
                >
                  <Btn variant="ghost" className="py-1.5">
                    Open pay page
                  </Btn>
                </Link>
                <Btn variant="ghost" className="py-1.5" onClick={() => remove(i.id)}>
                  Remove
                </Btn>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </Shell>
  );
}
