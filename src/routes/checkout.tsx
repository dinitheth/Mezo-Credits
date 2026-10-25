import { createFileRoute, useHydrated } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Shell } from "@/components/Shell";
import { InvoiceQR } from "@/components/InvoiceQR";
import { Btn, Card } from "@/components/ui-bits";
import {
  MEZO,
  getState,
  logActivity,
  num,
  setActivityStatus,
  setState,
  short,
  useStore,
} from "@/lib/mezo";
import {
  approveRouter,
  didSucceed,
  getMusdBalance,
  musdAddressFor,
  payViaRouter,
  routerAddressFor,
  sendMusd,
  signInvoice712,
  waitForReceipt,
} from "@/lib/onchain";
import { friendly } from "@/lib/errors";
import { cn } from "@/lib/utils";

const search = z.object({
  id: z.string().catch(""),
  amount: z.coerce.number().catch(0),
  to: z.string().catch(""),
  desc: z.string().catch(""),
});

export const Route = createFileRoute("/checkout")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Pay this bill · MezoFlow" },
      { name: "description", content: "Pay an MUSD bill from your wallet." },
      { property: "og:title", content: "Pay this bill — MezoFlow" },
      { property: "og:description", content: "Settle an MUSD bill in one step." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Checkout,
});

function Checkout() {
  const inv = Route.useSearch();
  const hydrated = useHydrated();
  const s = useStore();
  const [mode, setMode] = useState<"direct" | "router">("router");
  const [tx, setTx] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const markPaid = (t: string, how: string) => {
    setState({
      invoices: getState().invoices.map((i) => (i.id === inv.id ? { ...i, paid: true, tx: t } : i)),
    });
    logActivity("invoice_paid", inv.amount, "MUSD", `${how} · to ${short(inv.to)}`, t);
    setTx(t);
    void didSucceed(t).then((ok) => {
      if (ok === false) {
        setActivityStatus(t, "failed");
        setState({
          invoices: getState().invoices.map((i) =>
            i.id === inv.id ? { ...i, paid: false, tx: undefined } : i,
          ),
        });
        setTx(null);
        setErr("That did not go through (see Past payments). Nothing moved.");
      }
    });
  };

  const needMezo = () => {
    const musd = musdAddressFor(s.chainId);
    if (!s.account) throw new Error("Connect your wallet first (button at the top).");
    if (!musd || (s.chainId !== 31611 && s.chainId !== 31612))
      throw new Error("Switch to the Mezo network in your wallet first.");
    return { account: s.account, musd };
  };

  const needFunds = async (account: string, musd: string) => {
    const held = await getMusdBalance(account, musd).catch(() => 0);
    if (held < inv.amount)
      throw new Error(
        `You hold ${held} MUSD — less than this bill. Get test MUSD first, then pay.`,
      );
  };

  const payDirect = async () => {
    setBusy(true);
    setErr(null);
    try {
      const { account, musd } = needMezo();
      await needFunds(account, musd);
      const hash = await sendMusd(inv.to, inv.amount, musd, account);
      markPaid(hash, "Direct payment");
    } catch (e) {
      setErr(friendly(e));
    } finally {
      setBusy(false);
    }
  };

  const payWithRouter = async () => {
    setBusy(true);
    setErr(null);
    try {
      const { account, musd } = needMezo();
      const chainId = s.chainId ?? 31611;
      const router = routerAddressFor(s.chainId);
      if (!router) throw new Error("Payment contract is not ready yet. Use direct payment.");
      await needFunds(account, musd);
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const nonce = `${Date.now()}`;
      const signature = await signInvoice712(account, chainId, router, {
        id: inv.id || "no-id",
        amount: inv.amount,
        to: inv.to,
        desc: inv.desc.slice(0, 140),
        deadline,
        nonce,
      });
      const approval = await approveRouter(musd, router, inv.amount, account);
      await waitForReceipt(approval);
      const hash = await payViaRouter(
        router,
        {
          payer: account,
          id: inv.id || "no-id",
          amount: inv.amount,
          to: inv.to,
          desc: inv.desc.slice(0, 140),
          deadline,
          nonce,
          sig: signature,
        },
        account,
      );
      markPaid(hash, "Paid through the payment contract");
    } catch (e) {
      setErr(friendly(e));
    } finally {
      setBusy(false);
    }
  };

  if (!inv.amount || !inv.to)
    return (
      <Shell showNavigation={false}>
        <Card>This payment link is missing details. Ask the sender for a new one.</Card>
      </Shell>
    );

  return (
    <Shell showNavigation={false}>
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="text-3xl font-bold">Pay this bill</h1>
        <Card className="text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Someone asks for</p>
          <p className="mt-2 font-mono text-4xl text-success">
            {num(inv.amount, 2)} <span className="text-lg">MUSD</span>
          </p>
          <p className="mt-2">{inv.desc}</p>
          <p className="font-mono text-xs text-muted-foreground">to {short(inv.to)}</p>
          {hydrated && !tx && (
            <div className="mt-4 border-t pt-4">
              <p className="mb-3 text-xs text-muted-foreground">Scan with your phone to pay</p>
              <InvoiceQR url={window.location.href} amount={inv.amount} description={inv.desc} />
            </div>
          )}
        </Card>
        {tx ? (
          <Card className="space-y-3 text-center">
            <div className="text-5xl text-success">✓</div>
            <h2 className="text-xl font-semibold">Paid. Thank you.</h2>
            <a
              className="block break-all font-mono text-xs text-primary underline"
              href={`${MEZO.explorer}/tx/${tx}`}
              target="_blank"
              rel="noreferrer"
            >
              {tx}
            </a>
            <p className="text-xs text-muted-foreground">Tap the code above to see it on Mezo.</p>
          </Card>
        ) : (
          <Card>
            <div className="mb-5 grid grid-cols-2 gap-2 rounded-lg bg-muted p-1" role="tablist">
              {(["router", "direct"] as const).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "rounded-md py-2 text-sm font-semibold",
                    mode === m ? "bg-card text-foreground" : "text-muted-foreground",
                  )}
                >
                  {m === "router" ? "Pay with receipt" : "Send directly"}
                </button>
              ))}
            </div>
            {mode === "direct" ? (
              <>
                <Btn className="w-full py-3" disabled={busy} onClick={() => void payDirect()}>
                  {busy ? "Paying…" : `Send ${num(inv.amount, 2)} MUSD`}
                </Btn>
                <p className="mt-2 text-xs text-muted-foreground">
                  One tap in your wallet, straight to the other person. There is no public receipt,
                  so the bill stays open.
                </p>
              </>
            ) : (
              <>
                <Btn
                  variant="green"
                  className="w-full py-3"
                  disabled={busy}
                  onClick={() => void payWithRouter()}
                >
                  {busy ? "Paying…" : `Approve and pay ${num(inv.amount, 2)} MUSD`}
                </Btn>
                <p className="mt-2 text-xs text-muted-foreground">
                  You approve once, then the payment contract moves the money, marks the bill paid
                  and keeps a public receipt.
                </p>
              </>
            )}
            {err && (
              <p role="alert" className="mt-2 text-xs text-destructive">
                {err}
              </p>
            )}
          </Card>
        )}
      </div>
    </Shell>
  );
}
