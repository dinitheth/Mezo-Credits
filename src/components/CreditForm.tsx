import { useState } from "react";
import { Field, Gauge, Stat, Tip, cleanNum, inputCls } from "./ui-bits";
import { MIN_CR, TIERS, crOf, liqPrice, num, usd, useStore } from "@/lib/mezo";
import { cn } from "@/lib/utils";

/** Borrowing planner. Math only — real borrowing happens in the Mezo app. */
export function CreditForm() {
  const s = useStore();
  const [tier, setTier] = useState<(typeof TIERS)[number]>(TIERS[1]);
  const [btcIn, setBtcIn] = useState("0.05");
  const btc = Number(btcIn) || 0;
  const price = s.btcPrice;

  const power = price > 0 ? (btc * price * 100) / tier.cr : 0;
  const cr = crOf(btc, power, price);
  const lp = liqPrice(btc, power);

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center text-sm text-muted-foreground">
          Safety level
          <Tip text="How much extra Bitcoin backs your loan. Mezo closes loans below 110%. A higher level means less to borrow but more room if the price falls." />
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

      <Field label="Bitcoin you would lock up">
        <input
          className={inputCls}
          inputMode="decimal"
          value={btcIn}
          onChange={(e) => setBtcIn(cleanNum(e.target.value))}
        />
      </Field>

      <p className="text-sm text-muted-foreground">
        Bitcoin price right now:{" "}
        <span className="font-mono text-foreground">
          {s.priceLive && price > 0 ? usd(price) : "loading…"}
        </span>
      </p>

      <div className="grid grid-cols-3 gap-4 rounded-lg border p-4">
        <Stat
          label="You could borrow"
          value={`${num(power, 2)}`}
          tone="green"
          tip="Dollars (MUSD) this Bitcoin supports at the chosen safety level."
        />
        <Stat
          label="Danger price"
          value={power > 0 ? usd(lp) : "—"}
          tone="red"
          tip={`If Bitcoin falls to this price, the loan hits ${MIN_CR}% and can be closed.`}
        />
        <Stat
          label="Safety"
          value={power > 0 ? `${tier.cr}%` : "—"}
          tone="gold"
          tip="Your backing level for this plan."
        />
      </div>
      {power > 0 && <Gauge cr={tier.cr} />}
      {tier.cr < 150 && (
        <p role="alert" className="text-sm text-destructive">
          Careful: at 150% a small price drop can close your loan.
        </p>
      )}

      <p className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
        Mezo asks for at least 1,800 MUSD per loan. When you have MUSD, send it from Get paid or
        watch it grow under Grow.
      </p>
    </div>
  );
}
