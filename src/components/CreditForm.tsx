import { useState } from "react";
import { Btn, Field, Gauge, Stat, Tip, cleanNum, inputCls } from "./ui-bits";
import {
  MIN_CR,
  TIERS,
  crOf,
  getState,
  liqPrice,
  logActivity,
  num,
  setState,
  usd,
  useStore,
} from "@/lib/mezo";
import {
  GAS_COMP_MUSD,
  borrowingFee,
  effectiveCr,
  expectedTotalDebt,
  validateBorrow,
} from "@/lib/onchain";
import { cn } from "@/lib/utils";

/** Shared credit calculator. If `targetMusd` is given, it sizes collateral to cover it (checkout). */
export function CreditForm({
  targetMusd,
  onDone,
  cta = "Open credit line",
}: {
  targetMusd?: number;
  onDone?: (tx: string, minted: number) => void;
  cta?: string;
}) {
  const s = useStore();
  const [tier, setTier] = useState<(typeof TIERS)[number]>(TIERS[1]);
  const needBtc = targetMusd ? (targetMusd * tier.cr) / 100 / s.btcPrice : 0;
  const [btcIn, setBtcIn] = useState("0.05");
  const btc = targetMusd ? Number(needBtc.toFixed(6)) : Number(btcIn) || 0;
  const [route, setRoute] = useState(!targetMusd);
  const [busy, setBusy] = useState(false);

  const totalColl = s.position.collateral + btc;
  const power = (btc * s.btcPrice * 100) / tier.cr;
  const mint = targetMusd ?? power;
  const newDebt = s.position.debt + mint;
  const cr = crOf(totalColl, newDebt, s.btcPrice);
  const lp = liqPrice(totalColl, newDebt);
  const fee = borrowingFee(mint);
  const totalDebt = expectedTotalDebt(mint);
  const effCr = btc > 0 && mint > 0 ? effectiveCr(btc, mint, s.btcPrice) : Infinity;
  const feeWarn = validateBorrow(mint);

  const submit = async () => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 1200));
    const p = getState().position;
    const toPool = route && !targetMusd;
    setState({
      position: {
        collateral: p.collateral + btc,
        debt: p.debt + mint,
        pool: p.pool + (toPool ? mint : 0),
      },
    });
    logActivity("add_collateral", btc, "BTC", "Trove collateral deposit");
    const tx = logActivity("borrow", mint, "MUSD", `Minted at ${tier.cr}% tier`);
    if (toPool) logActivity("pool_deposit", mint, "MUSD", "Auto-routed from mint");
    setBusy(false);
    onDone?.(tx, mint);
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center text-sm text-muted-foreground">
          Risk tier
          <Tip text="Collateral ratio (CR) = collateral value ÷ debt. Mezo liquidates Troves below 110%. Higher CR means less MUSD but more safety from BTC price drops." />
        </div>
        <div className="grid grid-cols-3 gap-2" role="radiogroup">
          {TIERS.map((t) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={tier.id === t.id}
              onClick={() => setTier(t)}
              className={cn(
                "rounded-lg border p-3 text-left transition",
                tier.id === t.id ? "border-primary bg-primary/10" : "hover:bg-muted",
              )}
            >
              <div className="text-sm font-semibold">{t.label}</div>
              <div className="font-mono text-lg text-primary">{t.cr}%</div>
              <div className="text-[11px] text-muted-foreground">{t.note}</div>
            </button>
          ))}
        </div>
      </div>

      {targetMusd ? (
        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          Collateral required: <b className="font-mono text-primary">{num(btc, 6)} BTC</b> to mint{" "}
          <b className="font-mono">{num(targetMusd, 2)} MUSD</b>
        </div>
      ) : (
        <Field
          label="BTC to deposit"
          tip="Native BTC on Mezo (18 decimals). Get BTC from the faucet."
        >
          <input
            className={inputCls}
            inputMode="decimal"
            value={btcIn}
            onChange={(e) => setBtcIn(cleanNum(e.target.value))}
          />
        </Field>
      )}

      <Field
        label={`BTC price (simulator): ${usd(s.btcPrice)}`}
        tip="Adjust the price to assess your position. Liquidation happens if the BTC price falls below your liquidation price."
      >
        <input
          type="range"
          min={10000}
          max={150000}
          step={500}
          value={s.btcPrice}
          onChange={(e) => setState({ btcPrice: Number(e.target.value) })}
          className="w-full accent-primary"
        />
      </Field>

      <div className="grid grid-cols-3 gap-4 rounded-lg border p-4">
        <Stat
          label={targetMusd ? "Minting" : "Borrow power"}
          value={`${num(mint, 2)}`}
          tone="green"
          tip="MUSD you can mint at the chosen collateral ratio."
        />
        <Stat
          label="Liq. price"
          value={usd(lp)}
          tone="red"
          tip={`BTC price at which your total Trove hits ${MIN_CR}% CR and becomes liquidatable.`}
        />
        <Stat
          label="Trove CR"
          value={isFinite(cr) ? `${cr.toFixed(0)}%` : "∞"}
          tone="gold"
          tip="Collateral ratio across your whole Trove after this action."
        />
      </div>
      <Gauge cr={cr} />
      {cr < 150 && (
        <p role="alert" className="text-sm text-destructive">
          ⚠ High risk: a {((1 - MIN_CR / cr) * 100).toFixed(0)}% BTC drop would trigger liquidation.
        </p>
      )}
      <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Protocol cost (for real Trove):</span> 1%
        fee {num(fee, 2)} MUSD + {GAS_COMP_MUSD} gas comp ={" "}
        <span className="font-mono">{num(totalDebt, 2)} total debt</span>
        {isFinite(effCr) && (
          <span>
            {" "}
            · effective CR <span className="font-mono">{effCr.toFixed(0)}%</span>
          </span>
        )}
        {feeWarn && (
          <span className="mt-1 block text-warning">
            Real Troves need ≥1,800 MUSD mint — simulated here so small invoices still demo.{" "}
            {feeWarn}
          </span>
        )}
      </div>

      {!targetMusd && (
        <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
          <input
            type="checkbox"
            checked={route}
            onChange={(e) => setRoute(e.target.checked)}
            className="mt-1 accent-success"
          />
          <span>
            Auto-route minted MUSD into the <b className="text-success">Stability Pool</b>
            <Tip text="The Stability Pool repays debt of liquidated Troves. Depositors receive the liquidated BTC at a discount, earning yield and supporting the MUSD peg." />
            <br />
            <span className="text-muted-foreground">Earn yield and help defend the $1 peg.</span>
          </span>
        </label>
      )}

      <Btn className="w-full py-3" onClick={submit} disabled={busy || btc <= 0}>
        {busy ? "Confirming on Mezo…" : cta}
      </Btn>
    </div>
  );
}
