import { createFileRoute, useHydrated } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Shell } from "@/components/Shell";
import { BitcoinMark } from "@/components/BitcoinMark";
import { CreditForm } from "@/components/CreditForm";
import { InvoiceQR } from "@/components/InvoiceQR";
import { Btn, Card } from "@/components/ui-bits";
import { MEZO, fakeTx, getState, logActivity, num, setState, short, useStore } from "@/lib/mezo";
import {
  approveRouter,
  musdAddressFor,
  payViaRouter,
  routerAddressFor,
  sendMusd,
  signInvoice712,
} from "@/lib/onchain";
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
      {
        name: "description",
        content: "Settle this MUSD invoice from your wallet or by minting MUSD against your BTC.",
      },
      { property: "og:title", content: "Pay with Credit — MezoFlow" },
      {
        property: "og:description",
        content: "Settle an MUSD invoice instantly using your Bitcoin credit line.",
      },
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
  const [sigMeta, setSigMeta] = useState<{ deadline: number; nonce: string } | null>(null);
  const [sigErr, setSigErr] = useState<string | null>(null);
  const [routerBusy, setRouterBusy] = useState(false);
  const [routerMsg, setRouterMsg] = useState<string | null>(null);

  const markPaid = (t: string, onchain = false, extra?: string) => {
    setState({
      invoices: getState().invoices.map((i) => (i.id === inv.id ? { ...i, paid: true, tx: t } : i)),
    });
    logActivity(
      "invoice_paid",
      inv.amount,
      "MUSD",
      `${mode === "credit" ? "Paid with credit (simulated Trove mint)" : onchain ? "Paid on-chain via MUSD transfer" : "Paid from balance (simulated)"} · to ${short(inv.to)}${extra ? ` · ${extra}` : ""}`,
      t,
      onchain,
    );
    setTx(t);
    setTxOnchain(onchain);
  };

  const payOnchain = async () => {
    setBusy(true);
    setPayErr(null);
    try {
      const musd = musdAddressFor(s.chainId);
      if (!s.account) throw new Error("Connect a wallet first.");
      if (!musd || (s.chainId !== 31611 && s.chainId !== 31612))
        throw new Error("Switch to Mezo testnet (31611) for a live MUSD transfer.");
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
      const verifying = routerAddressFor(chainId) ?? musdAddressFor(chainId) ?? inv.to;
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const nonce = `${Date.now()}`;
      const signature = await signInvoice712(account, chainId, verifying, {
        id: inv.id || "no-id",
        amount: inv.amount,
        to: inv.to,
        desc: inv.desc.slice(0, 140),
        deadline,
        nonce,
      });
      setSig(signature);
      setSigMeta({ deadline, nonce });
    } catch (e) {
      setSigErr(e instanceof Error ? e.message : String(e));
    }
  };

  const payViaRouterFlow = async () => {
    setRouterMsg(null);
    setSigErr(null);
    try {
      const account = s.account;
      const chainId = s.chainId;
      if (!account) throw new Error("Connect a wallet first.");
      if (!chainId) throw new Error("Unknown chain.");
      const router = routerAddressFor(chainId);
      const musd = musdAddressFor(chainId);
      if (!router)
        throw new Error(
          "Set VITE_ROUTER_ADDRESS_TESTNET after deploying contracts/InvoiceRouter.sol (see contracts/README.md).",
        );
      if (!musd) throw new Error("No MUSD on this chain — switch to Mezo testnet (31611).");
      let signature = sig;
      let meta = sigMeta;
      if (!signature || !meta) {
        await signDelegation();
        signature = sig;
        meta = sigMeta;
        if (!signature || !meta) throw new Error("Sign the invoice first, then submit via Router.");
      }
      setRouterBusy(true);
      await approveRouter(musd, router, inv.amount, account).catch((e) => {
        if (/rejected|denied/i.test(e instanceof Error ? e.message : String(e))) throw e;
      });
      const hash = await payViaRouter(
        router,
        {
          payer: account,
          id: inv.id || "no-id",
          amount: inv.amount,
          to: inv.to,
          desc: inv.desc.slice(0, 140),
          deadline: meta.deadline,
          nonce: meta.nonce,
          sig: signature,
        },
        account,
      );
      setState({
        invoices: getState().invoices.map((i) =>
          i.id === inv.id ? { ...i, paid: true, tx: hash } : i,
        ),
      });
      logActivity(
        "invoice_paid",
        inv.amount,
        "MUSD",
        `Paid via InvoiceRouter · to ${short(inv.to)} · EIP-712 ${signature.slice(0, 12)}…`,
        hash,
        true,
      );
      setTx(hash);
      setTxOnchain(true);
      setRouterMsg(`Router tx broadcast: ${hash.slice(0, 12)}…`);
    } catch (e) {
      setSigErr(e instanceof Error ? e.message : String(e));
    } finally {
      setRouterBusy(false);
    }
  };

  if (!inv.amount || !inv.to)
    return (
      <Shell>
        <Card>This payment link is invalid or incomplete.</Card>
      </Shell>
    );

  return (
    <Shell>
      <div className="mx-auto max-w-xl space-y-4">
        <Card className="text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Payment request</p>
          <p className="mt-2 font-mono text-4xl text-success">
            {num(inv.amount, 2)} <span className="text-lg">MUSD</span>
          </p>
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
            <h2 className="text-xl font-semibold">
              Invoice settled {txOnchain ? "on-chain" : "(simulated)"}
            </h2>
            <a
              className="block break-all font-mono text-xs text-primary underline"
              href={`${MEZO.explorer}/tx/${tx}`}
              target="_blank"
              rel="noreferrer"
            >
              {tx}
            </a>
            {!txOnchain && (
              <p className="text-xs text-muted-foreground">
                Simulated hash — will not resolve. Use Pay from MUSD balance on Mezo testnet for a
                live transfer.
              </p>
            )}
          </Card>
        ) : (
          <Card>
            <div className="mb-5 grid grid-cols-2 gap-2 rounded-lg bg-muted p-1" role="tablist">
              {(["credit", "wallet"] as const).map((m) => (
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
                <CreditForm
                  targetMusd={inv.amount}
                  cta="Mint MUSD & pay"
                  onDone={(t) =>
                    markPaid(t, false, sig ? `EIP-712 ${sig.slice(0, 12)}…` : undefined)
                  }
                />
                <div className="mt-4 rounded-lg border p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">EIP-712 + InvoiceRouter (Wave 1)</span>
                    <button
                      type="button"
                      onClick={() => void signDelegation()}
                      className="text-primary underline"
                    >
                      Sign invoice
                    </button>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    Typed signature authorises exactly this invoice. With
                    `VITE_ROUTER_ADDRESS_TESTNET` set it verifies on-chain via `payInvoice`; without
                    it the sig is stored in the ledger note.
                  </p>
                  {sig && (
                    <p className="mt-1 break-all font-mono text-[11px] text-success">{sig}</p>
                  )}
                  <Btn
                    variant="green"
                    className="mt-2 w-full py-2"
                    disabled={routerBusy}
                    onClick={() => void payViaRouterFlow()}
                  >
                    {routerBusy ? "Submitting via Router…" : "Approve + Pay via Router"}
                  </Btn>
                  {routerMsg && <p className="mt-1 text-success">{routerMsg}</p>}
                  {sigErr && (
                    <p role="alert" className="mt-1 text-destructive">
                      {sigErr}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <Btn
                  variant="green"
                  className="w-full py-3"
                  disabled={busy}
                  onClick={() => void payOnchain()}
                >
                  {busy ? "Broadcasting…" : `Send ${num(inv.amount, 2)} MUSD on-chain`}
                </Btn>
                <p className="mt-2 text-xs text-muted-foreground">
                  Live ERC-20 transfer on Mezo testnet when connected (chain 31611). Falls back to
                  simulated ledger if rejected.
                </p>
                {payErr && (
                  <p role="alert" className="mt-2 text-xs text-destructive">
                    {payErr}
                  </p>
                )}
              </>
            )}
          </Card>
        )}
      </div>
    </Shell>
  );
}
