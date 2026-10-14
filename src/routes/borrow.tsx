import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/Shell";
import { BtcWord } from "@/components/BitcoinMark";
import { CreditForm } from "@/components/CreditForm";
import { OnchainPanel } from "@/components/OnchainPanel";
import { Btn, Card } from "@/components/ui-bits";
import { MEZO, num } from "@/lib/mezo";

export const Route = createFileRoute("/borrow")({
  head: () => ({
    meta: [
      { title: "1-Click Credit Line — MezoFlow" },
      { name: "description", content: "Deposit BTC, choose a risk tier and mint MUSD on Mezo with a live risk calculator." },
      { property: "og:title", content: "1-Click BTC Credit Line — MezoFlow" },
      { property: "og:description", content: "Conservative, Balanced or Active tiers with live liquidation price and health gauge." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Borrow,
});

function Borrow() {
  const [done, setDone] = useState<{ tx: string; m: number } | null>(null);
  return (
    <Shell>
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <h1 className="text-3xl font-bold">1-Click Credit Line</h1>
          <p className="mt-2 text-muted-foreground">Lock BTC as collateral and mint MUSD, Mezo's
            <BtcWord text="Bitcoin-backed" /> stablecoin. Pick how much safety buffer you want.</p>
          <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
            <li><b className="text-foreground">Minimum CR 110%.</b> Below this, anyone can liquidate your Trove.</li>
            <li><b className="text-foreground">Fixed-rate borrowing.</b> Your rate is locked when you open.</li>
            <li><b className="text-foreground">Stability Pool.</b> Deposited MUSD absorbs bad debt and earns liquidated BTC.</li>
          </ul>
        </div>
        <Card className="lg:col-span-3">
          {done ? (
            <div className="space-y-4 text-center">
              <div className="text-5xl">✓</div>
              <h2 className="text-xl font-semibold">Minted {num(done.m, 2)} MUSD</h2>
              <a className="block break-all font-mono text-xs text-primary underline" href={`${MEZO.explorer}/tx/${done.tx}`} target="_blank" rel="noreferrer">{done.tx}</a>
              <p className="text-xs text-muted-foreground">Simulated Trove mint + ledger entry. For a live transfer, settle via Checkout → Pay from MUSD balance on Mezo testnet.</p>
              <div className="flex justify-center gap-2"><Link to="/dashboard"><Btn>View position</Btn></Link><Btn variant="ghost" onClick={() => setDone(null)}>Borrow more</Btn></div>
            </div>
          ) : (
            <CreditForm onDone={(tx, m) => setDone({ tx, m })} />
          )}
        </Card>
      </div>
      <div className="mt-4"><OnchainPanel /></div>
    </Shell>
  );
}
