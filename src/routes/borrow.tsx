import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/Shell";
import { BtcWord } from "@/components/BitcoinMark";
import { CreditForm } from "@/components/CreditForm";
import { OnchainPanel } from "@/components/OnchainPanel";
import { Btn, Card } from "@/components/ui-bits";
import { logActivity, num, useStore } from "@/lib/mezo";
import {
  getVaultPosition,
  parseMUSD,
  vaultAddressFor,
  vaultOpenLoan,
  vaultSetPrice,
} from "@/lib/onchain";

export const Route = createFileRoute("/borrow")({
  head: () => ({
    meta: [
      { title: "Borrow — MezoFlow" },
      {
        name: "description",
        content: "Lock Bitcoin and borrow MUSD from the shared pool.",
      },
      { property: "og:title", content: "Borrow — MezoFlow" },
      {
        property: "og:description",
        content: "Bitcoin-backed borrowing on Mezo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Borrow,
});

function Borrow() {
  const s = useStore();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const vault = vaultAddressFor(s.chainId);

  const borrow = async (info: { btc: number; amount: number; tier: number }) => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      if (!s.account) throw new Error("Connect your wallet first.");
      if (!vault) throw new Error("The pool is not open yet. It opens right after launch.");
      if (!s.priceLive || s.btcPrice <= 0) throw new Error("Waiting on the live price. Try again.");
      const pos = await getVaultPosition(vault, s.account);
      const want = parseMUSD(info.amount.toFixed(2));
      if (want > pos.poolBalance)
        throw new Error(
          pos.poolBalance === 0n
            ? "The pool is empty, so there is nothing to borrow yet. Seed it once: borrow test MUSD on Mezo's test site, put it in on the Grow page, then borrow here."
            : `The pool holds ${Number(pos.poolBalance) / 1e18} MUSD — less than this loan. Try a smaller amount.`,
        );
      if (pos.price === 0n) {
        if (pos.owner.toLowerCase() !== s.account.toLowerCase())
          throw new Error("Pool prices are updating. Try again in a minute.");
        await vaultSetPrice(vault, s.account, s.btcPrice);
      }
      const hash = await vaultOpenLoan(
        vault,
        s.account,
        info.amount.toFixed(2),
        info.tier,
        info.btc,
      );
      logActivity("borrow", info.amount, "MUSD", `Locked ${info.btc} BTC at ${info.tier}%`, hash);
      setMsg(`Borrowed ${num(info.amount, 2)} MUSD · receipt ${hash.slice(0, 12)}…`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Borrowing did not go through. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <h1 className="text-3xl font-bold">Borrow</h1>
          <p className="mt-2 text-muted-foreground">
            Lock Bitcoin here and borrow MUSD, Mezo&apos;s
            <BtcWord text="Bitcoin-backed" /> dollar. Lenders fund the pool and earn the fees.
          </p>
          <ol className="mt-6 space-y-3 text-sm text-muted-foreground">
            <li>
              <b className="text-foreground">1. Type your Bitcoin.</b> The live price fills in by
              itself.
            </li>
            <li>
              <b className="text-foreground">2. Pick a safety level.</b> Higher means less to
              borrow, more room if prices fall.
            </li>
            <li>
              <b className="text-foreground">3. Borrow.</b> Your Bitcoin locks in our pool contract
              and MUSD lands in your wallet.
            </li>
          </ol>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/dashboard">
              <Btn variant="ghost">See your loan</Btn>
            </Link>
          </div>
          {msg && (
            <p className="mt-3 text-sm text-success" aria-live="polite">
              {msg}
            </p>
          )}
          {err && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {err}
            </p>
          )}
        </div>
        <Card className="lg:col-span-3">
          {!vault ? (
            <div className="space-y-3 text-center">
              <h2 className="text-xl font-semibold">The pool opens at launch</h2>
              <p className="text-sm text-muted-foreground">
                Lending starts as soon as our pool contract is live on Mezo. The planner below
                already runs on live prices.
              </p>
            </div>
          ) : null}
          <CreditForm onBorrow={vault ? borrow : undefined} borrowing={busy} />
        </Card>
      </div>
      <div className="mt-4">
        <OnchainPanel />
      </div>
    </Shell>
  );
}
