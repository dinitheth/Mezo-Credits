import { createFileRoute, useHydrated } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Shell } from "@/components/Shell";
import { BitcoinMark } from "@/components/BitcoinMark";
import { CreditForm } from "@/components/CreditForm";
import { InvoiceQR } from "@/components/InvoiceQR";
import { Btn, Card } from "@/components/ui-bits";
import { MEZO, fakeTx, getState, logActivity, num, setState, short, useStore } from "@/lib/mezo";
import { musdAddressFor, sendMusd, signInvoice712 } from "@/lib/onchain";
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
      { title: "Checkout — Pay with Credit · MezoFlow" },
      { name: "description", content: "Settle this MUSD invoice from your wallet or by minting MUSD against your BTC." },
      { property: "og:title", content: "Pay with Credit — MezoFlow" },
      { property: "og:description", content: "Settle an MUSD invoice instantly using your Bitcoin credit line." },
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
  const [mode, setMode] = useState<"credit" | "wallet">("credit");
  const [tx, setTx] = useState<string | null>(null);
  const [txOnchain, setTxOnchain] = useState(false);
  const [busy, setBusy] = useState(false);
  const [payErr, setPayErr] = useState<string | null>(null);
  const [sig, setSig] = useState<string | null>(null);
  const [sigErr, setSigErr] = useState<string | null>(null);

  const markPaid = (t: string, onchain = false, extra?: string) => {
    setState({ invoices: getState().invoices.map((i) => (i.id === inv.id ? { ...i, paid: true, tx: t } : i)) });
    logActivity("invoice_paid", inv.amount, "MUSD", `${mode === "credit" ? "Paid with credit (simulated Trove mint)" : onchain ? "Paid on-chain via MUSD transfer" : "Paid from balance (simulated)"} · to ${short(inv.to)}${extra ? ` · ${extra}` : ""}`, t, onchain);
    setTx(t);
    setTxOnchain(onchain);
  };

  const payOnchain = async () => {
    setBusy(true);
    setPayErr(null);
    try {
      const musd = musdAddressFor(s.chainId);
      if (!s.account) throw new Error("Connect a wallet first.");
      if (!musd || (s.chainId !== 31611 && s.chainId !== 31612)) throw new Error("Switch to Mezo testnet (31611) for a live MUSD transfer.");
      const hash = await sendMusd(inv.to, inv.amount, musd, s.account);
      markPaid(hash, true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // User rejection or no funds: fall back to simulated ledger so demo never dead-ends.
      if (/rejected|denied|insufficient|no musd|no browser/i.test(msg)) {
        setPayErr(`${msg} — recorded as simulated instead.`);
        markPaid(fakeTx(), false, "simulated fallback");
      } else {
        setPayErr(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const signDelegation = async () => {
    setSigErr(null);
    try {
      const account = s.account;
      const chainId = s.chainId;
      if (!account) throw new Error("Connect a wallet first.");
      if (!chainId) throw new Error("Unknown chain.");
      const verifying = musdAddressFor(chainId) ?? inv.to;
      const signature = await signInvoice712(account, chainId, verifying, {
        id: inv.id || "no-id",
        amount: inv.amount,
        to: inv.to,
        desc: inv.desc.slice(0, 140),
        deadline: Math.floor(Date.now() / 1000) + 3600,
        nonce: `${Date.now()}`,
      });
      setSig(signature);
    } catch (e) {
      setSigErr(e instanceof Error ? e.message : String(e));
    }
  };

  if (!inv.amount || !inv.to) return <Shell><Card>This payment link is invalid or incomplete.</Card></Shell>;

  return (
    <Shell>
      <div className="mx-auto max-w-xl space-y-4">
        <Card className="text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Payment request</p>
          <p className="mt-2 font-mono text-4xl text-success">{num(inv.amount, 2)} <span className="text-lg">MUSD</span></p>
          <p className="mt-2">{inv.desc}</p>
          <p className="font-mono text-xs text-muted-foreground">to {short(inv.to)}</p>
          {hydrated && !tx && (
            <div className="mt-4 border-t pt-4">
              <p className="mb-3 text-xs text-muted-foreground">Scan with a mobile wallet to pay</p>
              <InvoiceQR url={window.location.href} amount={inv.amount} description={inv.desc} />
            </div>
          )}
        </Card>
        {tx ? (
          <Card className="space-y-3 text-center">
            <div className="text-5xl text-success">✓</div>
            <h2 className="text-xl font-semibold">Invoice settled {txOnchain ? "on-chain" : "(simulated)"}</h2>
            <a className="block break-all font-mono text-xs text-primary underline" href={`${MEZO.explorer}/tx/${tx}`} target="_blank" rel="noreferrer">{tx}</a>
            {!txOnchain && <p className="text-xs text-muted-foreground">Simulated hash — will not resolve. Use Pay from MUSD balance on Mezo testnet for a live transfer.</p>}
          </Card>
        ) : (
          <Card>
            <div className="mb-5 grid grid-cols-2 gap-2 rounded-lg bg-muted p-1" role="tablist">
              {(["credit", "wallet"] as const).map((m) => (
                <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
                  className={cn("rounded-md py-2 text-sm font-semibold", mode === m ? "bg-card text-foreground" : "text-muted-foreground")}>
                  {m === "credit" ? (
                    <>
                      <BitcoinMark className="mr-[0.3em] inline-block h-[1.05em] w-[1.05em] align-[-0.16em]" />
                      Pay with Credit
                    </>
                  ) : (
                    "Pay from MUSD balance"
                  )}
                </button>
              ))}
            </div>
            {mode === "credit" ? (
              <>
                <CreditForm targetMusd={inv.amount} cta="Mint MUSD & pay" onDone={(t) => markPaid(t, false, sig ? `EIP-712 ${sig.slice(0, 12)}…` : undefined)} />
                <div className="mt-4 rounded-lg border p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">EIP-712 delegation (Wave 2)</span>
                    <button type="button" onClick={() => void signDelegation()} className="text-primary underline">Sign invoice</button>
                  </div>
                  <p className="mt-1 text-muted-foreground">Typed signature authorises exactly this invoice (`pay id amount to`). Router verification is phase 3; signature is stored in the ledger note today.</p>
                  {sig && <p className="mt-1 break-all font-mono text-[11px] text-success">{sig}</p>}
                  {sigErr && <p role="alert" className="mt-1 text-destructive">{sigErr}</p>}
                </div>
              </>
            ) : (
              <>
                <Btn variant="green" className="w-full py-3" disabled={busy} onClick={() => void payOnchain()}>
                  {busy ? "Broadcasting…" : `Send ${num(inv.amount, 2)} MUSD on-chain`}
                </Btn>
                <p className="mt-2 text-xs text-muted-foreground">Live ERC-20 transfer on Mezo testnet when connected (chain 31611). Falls back to simulated ledger if rejected.</p>
                {payErr && <p role="alert" className="mt-2 text-xs text-destructive">{payErr}</p>}
              </>
            )}
          </Card>
        )}
      </div>
    </Shell>
  );
}
