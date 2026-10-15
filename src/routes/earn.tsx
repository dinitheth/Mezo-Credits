import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/Shell";
import { Btn, Card, Field, Stat, cleanNum, inputCls } from "@/components/ui-bits";
import { OnchainPanel } from "@/components/OnchainPanel";
import {
  POOL,
  getState,
  logActivity,
  num,
  sats,
  setState,
  usd,
  usePriceFeed,
  useStore,
} from "@/lib/mezo";

export const Route = createFileRoute("/earn")({
  head: () => ({
    meta: [
      { title: "Stability Pool — Earn BTC with MUSD · MezoFlow" },
      {
        name: "description",
        content:
          "Deposit MUSD into Mezo's Stability Pool, earn liquidated BTC at a discount, and claim or compound rewards.",
      },
      { property: "og:title", content: "Earn in the Mezo Stability Pool — MezoFlow" },
      {
        property: "og:description",
        content: "Pool APY, total staked MUSD, your deposit and accrued BTC rewards in one view.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Earn,
});

function Earn() {
  const s = useStore();
  usePriceFeed(true);
  const { pool, debt } = s.position;
  const [dep, setDep] = useState("");
  const [wd, setWd] = useState("");
  const [msg, setMsg] = useState("");
  // MUSD the user holds outside the pool (minted but not deposited or repaid).
  const wallet = Math.max(0, debt - pool);
  const total = POOL.baseStaked + pool;
  const share = total > 0 ? (pool / total) * 100 : 0;

  const deposit = () => {
    const a = Math.min(Number(dep) || 0, wallet);
    if (!a) return;
    const p = getState().position;
    setState({ position: { ...p, pool: p.pool + a } });
    const tx = logActivity("pool_deposit", a, "MUSD");
    setDep("");
    setMsg(`Deposited ${num(a, 2)} MUSD · tx ${tx.slice(0, 12)}…`);
  };
  const withdraw = () => {
    const a = Math.min(Number(wd) || 0, pool);
    if (!a) return;
    const p = getState().position;
    setState({ position: { ...p, pool: p.pool - a } });
    const tx = logActivity("pool_withdraw", a, "MUSD", "Withdrawn to wallet");
    setWd("");
    setMsg(`Withdrew ${num(a, 2)} MUSD · tx ${tx.slice(0, 12)}…`);
  };
  const claim = (compound: boolean) => {
    const r = getState().rewardsBtc;
    if (!r) return;
    const p = getState().position;
    if (compound) setState({ rewardsBtc: 0, position: { ...p, collateral: p.collateral + r } });
    else setState({ rewardsBtc: 0 });
    const tx = logActivity(
      compound ? "compound_rewards" : "claim_rewards",
      r,
      "BTC",
      compound ? "Added to Trove collateral" : "Sent to wallet",
    );
    setMsg(`${compound ? "Compounded" : "Claimed"} ${num(r, 8)} BTC · tx ${tx.slice(0, 12)}…`);
  };

  return (
    <Shell>
      <h1 className="text-3xl font-bold">Stability Pool</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Deposit MUSD to back the system. When a Trove is liquidated, the pool repays its debt and
        depositors receive the BTC collateral at a discount.
      </p>

      <Card className="mt-6">
        <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
          <Stat
            label="Pool APY"
            value={`${POOL.apy}%`}
            tone="green"
            tip="Estimated yearly return from liquidation gains and incentives. Rewards vary with liquidation activity."
          />
          <Stat
            label="Total staked"
            value={`${num(total / 1e6, 2)}M MUSD`}
            tip="All MUSD currently deposited in the Stability Pool."
          />
          <Stat
            label="Your deposit"
            value={`${num(pool, 2)} MUSD`}
            tone="green"
            tip={`Your share of the pool: ${share.toFixed(4)}%.`}
          />
          <Stat
            label="BTC rewards"
            value={`${num(s.rewardsBtc, 8)} BTC`}
            tone="gold"
            tip={`${sats(s.rewardsBtc)} sats ≈ ${usd(s.rewardsBtc * s.btcPrice)}. Rewards accrue faster than real time in this demo.`}
          />
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="space-y-3">
          <h2 className="font-semibold">Deposit MUSD</h2>
          <Field
            label={`Available: ${num(wallet, 2)} MUSD`}
            tip="MUSD you minted that is not already in the pool."
          >
            <div className="flex gap-2">
              <input
                className={inputCls}
                inputMode="decimal"
                value={dep}
                onChange={(e) => setDep(cleanNum(e.target.value))}
                placeholder="0.00"
              />
              <Btn variant="green" onClick={deposit} disabled={!wallet}>
                Deposit
              </Btn>
            </div>
          </Field>
          <button
            type="button"
            className="text-xs text-muted-foreground underline"
            onClick={() => setDep(wallet.toFixed(2))}
          >
            Use max
          </button>
        </Card>
        <Card className="space-y-3">
          <h2 className="font-semibold">Withdraw MUSD</h2>
          <Field label={`In pool: ${num(pool, 2)} MUSD`}>
            <div className="flex gap-2">
              <input
                className={inputCls}
                inputMode="decimal"
                value={wd}
                onChange={(e) => setWd(cleanNum(e.target.value))}
                placeholder="0.00"
              />
              <Btn variant="ghost" onClick={withdraw} disabled={!pool}>
                Withdraw
              </Btn>
            </div>
          </Field>
          <button
            type="button"
            className="text-xs text-muted-foreground underline"
            onClick={() => setWd(pool.toFixed(2))}
          >
            Use max
          </button>
        </Card>
        <Card className="space-y-3">
          <h2 className="font-semibold">Claim BTC rewards</h2>
          <p className="font-mono text-2xl text-primary">
            {num(s.rewardsBtc, 8)} <span className="text-sm">BTC</span>
          </p>
          <div className="grid gap-2">
            <Btn onClick={() => claim(false)} disabled={!s.rewardsBtc}>
              Claim to wallet
            </Btn>
            <Btn variant="ghost" onClick={() => claim(true)} disabled={!s.rewardsBtc}>
              Compound into Trove collateral
            </Btn>
          </div>
        </Card>
      </div>
      {msg && (
        <p className="mt-3 text-sm text-success" aria-live="polite">
          {msg}
        </p>
      )}

      <div className="mt-4">
        <OnchainPanel />
      </div>

      <Card className="mt-4">
        <h2 className="font-semibold">MEZO utility</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          MEZO is the network token for fee discounts, governance and boosted incentives. Balances
          above are read live via <span className="font-mono">eth_call</span> when{" "}
          <span className="font-mono">VITE_MEZO_TOKEN_TESTNET/MAINNET</span> is set; otherwise this
          build documents the integration point without inventing an address. BTC stays the
          collateral and reward asset.
        </p>
      </Card>

      <section className="mt-10 grid gap-4 md:grid-cols-3">
        {[
          [
            "Absorbing liquidations",
            "When a Trove falls below 110% collateral, its MUSD debt is cancelled using pool deposits, keeping MUSD fully backed.",
          ],
          [
            "Earning BTC at a discount",
            "In return, the liquidated BTC is shared among depositors pro-rata. Since the Trove held at least ~110% of its debt in BTC, depositors get more value in BTC than the MUSD they gave up.",
          ],
          [
            "Defending the peg",
            "A deep pool means bad debt is cleared instantly, which keeps MUSD close to $1. Your deposit shrinks slightly in MUSD after each liquidation while your BTC rewards grow.",
          ],
        ].map(([t, d]) => (
          <Card key={t}>
            <h3 className="font-semibold text-primary">{t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
          </Card>
        ))}
      </section>
    </Shell>
  );
}
