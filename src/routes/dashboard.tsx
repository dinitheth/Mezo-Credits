import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Shell } from "@/components/Shell";
import { BtcWord } from "@/components/BitcoinMark";
import { Btn, Card, Field, Gauge, Stat, cleanNum, inputCls } from "@/components/ui-bits";
import { OnchainPanel } from "@/components/OnchainPanel";
import { MIN_CR, SAFE_CR, crOf, getState, health, liqPrice, logActivity, num, setState, usd, usePriceFeed, useStore } from "@/lib/mezo";

function ShieldCard({ cr, pool }: { cr: number; pool: number }) {
  const { shield } = useStore();
  const [perm, setPerm] = useState<string>("");
  const set = (p: Partial<typeof shield>) => setState({ shield: { ...getState().shield, ...p } });
  const toggleAlerts = async (on: boolean) => {
    set({ alerts: on });
    if (on && typeof Notification !== "undefined" && Notification.permission === "default") setPerm(await Notification.requestPermission());
  };
  const armed = shield.enabled && isFinite(cr);
  return (
    <Card className="lg:col-span-3">
      <div className="flex flex-wrap items-start gap-4">
        <ShieldCheck className={`h-8 w-8 shrink-0 ${shield.enabled ? "text-success" : "text-muted-foreground"}`} aria-hidden="true" />
        <div className="min-w-[220px] flex-1">
          <h2 className="font-semibold">Automated Liquidation Shield</h2>
          <p className="text-sm text-muted-foreground">When your collateral ratio falls below the trigger, MezoFlow repays debt from your Stability Pool deposit to lift the ratio back to trigger + 15%.</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Status: <b className={armed ? "text-success" : ""}>{shield.enabled ? "Armed" : "Off"}</b> · Pool available: <span className="font-mono">{num(pool, 2)} MUSD</span>
            {shield.enabled && pool === 0 && <span className="text-destructive"> · No pool deposit to repay from</span>}
          </p>
        </div>
        <div className="w-full space-y-3 sm:w-80">
          <label className="flex items-center justify-between gap-3 text-sm">
            Auto-repay from Stability Pool
            <input type="checkbox" className="h-4 w-4 accent-success" checked={shield.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
          </label>
          <Field label={`Trigger below ${shield.trigger}% CR`} tip={`Must stay above the ${MIN_CR}% liquidation floor. Lower triggers use the pool less often but leave less margin.`}>
            <input type="range" min={115} max={200} step={5} value={shield.trigger} onChange={(e) => set({ trigger: Number(e.target.value) })} className="w-full accent-primary" />
          </Field>
          <label className="flex items-center justify-between gap-3 text-sm">
            Browser alert notifications
            <input type="checkbox" className="h-4 w-4 accent-success" checked={shield.alerts} onChange={(e) => toggleAlerts(e.target.checked)} />
          </label>
          {perm === "denied" && <p className="text-xs text-destructive">Notifications are blocked in your browser settings.</p>}
          {shield.alerts && isFinite(cr) && cr < shield.trigger && <p role="alert" className="text-xs text-destructive">Your ratio ({cr.toFixed(0)}%) is below the shield trigger.</p>}
        </div>
      </div>
    </Card>
  );
}

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "MezoFlow Dashboard — Your BTC credit position" },
      { name: "description", content: "Borrow MUSD against BTC on Mezo and settle invoices instantly with credit links." },
      { property: "og:title", content: "MezoFlow Dashboard — Your BTC credit position" },
      { property: "og:description", content: "Manage collateral, MUSD debt and Stability Pool balances on Mezo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const s = useStore();
  usePriceFeed(true);
  const { collateral, debt, pool } = s.position;
  const cr = crOf(collateral, debt, s.btcPrice);
  const h = health(cr);
  const [repay, setRepay] = useState("");
  const [add, setAdd] = useState("");
  const [wd, setWd] = useState("");
  const [msg, setMsg] = useState("");
  // Max BTC withdrawable while keeping CR >= SAFE_CR.
  const maxWd = Math.max(0, debt > 0 ? collateral - (debt * SAFE_CR) / 100 / s.btcPrice : collateral);
  const wdNum = Number(wd) || 0;
  const wdCr = crOf(collateral - wdNum, debt, s.btcPrice);

  const doRepay = () => {
    const a = Math.min(Number(repay) || 0, debt);
    if (!a) return;
    setState({ position: { ...s.position, debt: debt - a } });
    const tx = logActivity("repay", a, "MUSD");
    setRepay(""); setMsg(`Repaid ${num(a, 2)} MUSD · tx ${tx.slice(0, 12)}…`);
  };
  const doAdd = () => {
    const a = Number(add) || 0;
    if (!a) return;
    setState({ position: { ...s.position, collateral: collateral + a } });
    const tx = logActivity("add_collateral", a, "BTC");
    setAdd(""); setMsg(`Added ${a} BTC collateral · tx ${tx.slice(0, 12)}…`);
  };
  const doWithdraw = () => {
    if (!wdNum || wdNum > maxWd + 1e-12) return;
    setState({ position: { ...s.position, collateral: collateral - wdNum } });
    const tx = logActivity("withdraw_collateral", wdNum, "BTC", isFinite(wdCr) ? `CR after: ${wdCr.toFixed(0)}%` : undefined);
    setWd(""); setMsg(`Withdrew ${num(wdNum, 6)} BTC to wallet · tx ${tx.slice(0, 12)}…`);
  };
  const withdrawPool = () => {
    if (!pool) return;
    const a = Math.min(pool, debt);
    setState({ position: { ...s.position, pool: pool - a, debt: debt - a } });
    logActivity("pool_withdraw", a, "MUSD", "Withdrawn to repay debt");
    logActivity("repay", a, "MUSD", "Repaid from Stability Pool");
    setMsg(`Withdrew ${num(a, 2)} MUSD from Stability Pool and used it to repay debt`);
  };

  return (
    <Shell>
      <section className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
          Your
          <BtcWord text="Bitcoin," markClassName="h-[0.8em] w-[0.8em] shrink-0" /> <span className="bg-gold bg-clip-text text-transparent">working</span>. <span className="text-success">Instantly.</span>
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">Lock BTC, mint MUSD at a fixed rate, earn in the Stability Pool, and pay invoices straight from your credit line.</p>
      </section>

      {collateral === 0 ? (
        <Card className="flex flex-col items-start gap-4 md:flex-row md:items-center">
          <div className="flex-1">
            <h2 className="text-xl font-semibold">No open position yet</h2>
            <p className="text-sm text-muted-foreground">Open a Trove in one click — pick a risk tier and we handle the rest.</p>
          </div>
          <Link to="/borrow"><Btn>Open credit line</Btn></Link>
          <Link to="/pay"><Btn variant="ghost">Create payment link</Btn></Link>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Trove position</h2>
              <span className="font-mono text-xs text-muted-foreground">BTC {usd(s.btcPrice)} · live</span>
            </div>
            <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
              <Stat label="Health score" value={`${h.score}/100`} tone={h.tone === "success" ? "green" : h.tone === "warning" ? "gold" : "red"} tip="A 0–100 summary of how far your collateral ratio is from the 110% liquidation line." />
              <Stat label="Collateral" value={`${num(collateral)} BTC`} tone="gold" tip="BTC locked in your Trove. Its USD value backs your MUSD debt." />
              <Stat label="Debt" value={`${num(debt, 2)} MUSD`} tip="MUSD you minted plus fees. Repay it to unlock collateral." />
              <Stat label="Stability Pool" value={`${num(pool, 2)} MUSD`} tone="green" tip="MUSD deposited to absorb liquidations. Depositors earn liquidated BTC and help defend the $1 peg." />
            </div>
            <div className="mt-6">
              <div className="mb-2 flex justify-between text-sm"><span>Collateral ratio: <b className="font-mono">{isFinite(cr) ? `${cr.toFixed(0)}%` : "∞"}</b></span><span className="text-muted-foreground">Liquidation at {usd(liqPrice(collateral, debt))}</span></div>
              <Gauge cr={cr} />
            </div>
            {cr < 150 && (
              <div role="alert" className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                ⚠ Your ratio is {cr.toFixed(0)}%. Below {MIN_CR}% your Trove can be liquidated and collateral lost. Add BTC or repay MUSD now.
              </div>
            )}
          </Card>
          <Card>
            <h2 className="mb-4 font-semibold">Quick actions</h2>
            <div className="space-y-4">
              <Field label="Repay MUSD">
                <div className="flex gap-2"><input className={inputCls} inputMode="decimal" value={repay} onChange={(e) => setRepay(cleanNum(e.target.value))} placeholder="0.00" /><Btn variant="green" onClick={doRepay}>Repay</Btn></div>
              </Field>
              <Field label="Add BTC collateral">
                <div className="flex gap-2"><input className={inputCls} inputMode="decimal" value={add} onChange={(e) => setAdd(cleanNum(e.target.value))} placeholder="0.0" /><Btn onClick={doAdd}>Add</Btn></div>
              </Field>
              <Field label="Withdraw collateral" tip={`Withdraw excess BTC while your collateral ratio stays at or above ${SAFE_CR}%.`}>
                <div className="flex gap-2">
                  <input className={inputCls} inputMode="decimal" value={wd} onChange={(e) => setWd(cleanNum(e.target.value))} placeholder="0.0" />
                  <Btn variant="ghost" onClick={doWithdraw} disabled={!wdNum || wdNum > maxWd + 1e-12}>Withdraw</Btn>
                </div>
                <span className="mt-1 flex justify-between text-xs text-muted-foreground">
                  <button type="button" className="underline" onClick={(e) => { e.preventDefault(); setWd(maxWd.toFixed(6)); }}>Max {num(maxWd, 6)} BTC</button>
                  {wdNum > 0 && <span className={wdNum > maxWd + 1e-12 ? "text-destructive" : ""}>CR after: {isFinite(wdCr) && wdCr > 0 ? `${wdCr.toFixed(0)}%` : "∞"}</span>}
                </span>
              </Field>
              <Btn variant="ghost" className="w-full" onClick={withdrawPool} disabled={!pool || !debt}>Withdraw pool → repay</Btn>
              {msg && <p className="text-xs text-success" aria-live="polite">{msg}</p>}
            </div>
          </Card>
          <ShieldCard cr={cr} pool={pool} />
        </div>
      )}

      <div className="mt-4"><OnchainPanel /></div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          ["1. Lock BTC", "Deposit BTC into a Trove — Mezo's collateralized debt position."],
          ["2. Mint MUSD", "Borrow dollar-pegged MUSD at a fixed rate, kept above 110% collateral."],
          ["3. Spend or earn", "Pay invoices instantly or route MUSD into the Stability Pool for yield."],
        ].map(([t, d]) => (
          <Card key={t}><h3 className="font-semibold text-primary">{t}</h3><p className="mt-1 text-sm text-muted-foreground">{d}</p></Card>
        ))}
      </div>
    </Shell>
  );
}
