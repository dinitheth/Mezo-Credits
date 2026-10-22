import { useEffect, useState } from "react";
import { Btn, Field, Gauge, Stat, Tip, cleanNum, inputCls } from "./ui-bits";
import { MIN_CR, TIERS, liqPrice, num, usd, useStore } from "@/lib/mezo";
import { cn } from "@/lib/utils";

/** Borrowing planner, wired to the pool contract by the Borrow page. */
export function CreditForm({
  onBorrow,
  borrowing,
  walletMusd,
  poolSize,
}: {
  onBorrow?: ((info: { btc: number; amount: number; tier: number }) => void) | undefined;
  borrowing?: boolean | undefined;
  /** MUSD already in the connected wallet; undefined hides the line. */
  walletMusd?: number | null | undefined;
  /** Current pool balance; undefined hides the line. */
  poolSize?: number | null | undefined;
}) {
  const s = useStore();
  const [tier, setTier] = useState<(typeof TIERS)[number]>(TIERS[1]);
  const [btcIn, setBtcIn] = useState("");
  const price = s.btcPrice;

  const maxBtc =
    price > 0 && poolSize !== undefined && poolSize !== null
      ? Math.floor(((poolSize * tier.cr) / (price * 100)) * 1e6) / 1e6
      : null;

  useEffect(() => {
    if (maxBtc === null) return;
    if ((Number(btcIn) || 0) > maxBtc) setBtcIn(maxBtc.toFixed(6));
  }, [maxBtc, btcIn]);

  const btc = Math.min(Number(btcIn) || 0, maxBtc ?? Infinity);
  const rawPower = price > 0 ? (btc * price * 100) / tier.cr : 0;
  const power =
    poolSize !== undefined && poolSize !== null ? Math.min(rawPower, poolSize) : rawPower;
  const lp = liqPrice(btc, power);

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center text-sm text-muted-foreground">
          Safety level
          <Tip text="How much extra Bitcoin backs your loan. Below 110% anyone can close it. A higher level means less to borrow but more room if the price falls." />
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
          placeholder="e.g. 0.05"
          value={btcIn}
          onChange={(e) => setBtcIn(cleanNum(e.target.value))}
        />
      </Field>
      {maxBtc !== null && poolSize !== undefined && poolSize !== null && (
        <p className="-mt-3 text-xs text-muted-foreground">
          The pool holds {num(poolSize, 2)} MUSD, so at this safety level you can lock up to{" "}
          {maxBtc.toFixed(6)} BTC here.
        </p>
      )}

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
        The pool charges 1% a year on what you owe, counted every second and paid to lenders. You
        can pay it back whenever you like.
      </p>

      {power > 0 && price > 0 && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 text-center">
          <p className="text-sm text-muted-foreground">Your number</p>
          <p className="font-mono text-2xl text-success">{num(power, 2)} MUSD</p>
          {poolSize !== undefined && poolSize !== null && rawPower > poolSize && (
            <p className="mt-1 text-xs text-muted-foreground">
              Pool limit: {num(poolSize, 2)} MUSD
            </p>
          )}
          {onBorrow && (
            <Btn
              className="mt-3 w-full py-3"
              disabled={borrowing || btc <= 0}
              onClick={() => onBorrow({ btc, amount: power, tier: tier.cr })}
            >
              {borrowing ? "Borrowing…" : `Borrow ${num(power, 2)} MUSD`}
            </Btn>
          )}
          {walletMusd !== undefined && (
            <p className="mt-2 text-xs text-muted-foreground">
              In your wallet now:{" "}
              <span className="font-mono text-foreground">
                {walletMusd === null ? "…" : `${num(walletMusd, 2)} MUSD`}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
