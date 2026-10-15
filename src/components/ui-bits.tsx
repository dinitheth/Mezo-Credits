import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-xl border bg-card p-5", className)}>{children}</div>;
}

export function Btn({
  variant = "gold",
  className,
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "gold" | "ghost" | "green" }) {
  return (
    <button
      {...p}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-ring",
        variant === "gold" && "bg-gold text-primary-foreground hover:brightness-110 shadow-glow",
        variant === "green" && "bg-success text-success-foreground hover:brightness-110",
        variant === "ghost" && "border bg-secondary text-secondary-foreground hover:bg-muted",
        className,
      )}
    />
  );
}

export function Tip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-describedby={id}
        aria-label="More info"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="ml-1 grid h-4 w-4 place-items-center rounded-full border text-[10px] text-muted-foreground hover:text-foreground"
      >
        ?
      </button>
      <span
        role="tooltip"
        id={id}
        className={cn(
          "absolute bottom-6 left-1/2 z-20 w-64 -translate-x-1/2 rounded-lg border bg-popover p-3 text-xs font-normal leading-relaxed text-popover-foreground shadow-xl",
          open ? "block" : "hidden",
        )}
      >
        {text}
      </span>
    </span>
  );
}

export function Stat({
  label,
  value,
  tip,
  tone,
}: {
  label: string;
  value: ReactNode;
  tip?: string;
  tone?: "gold" | "green" | "red";
}) {
  return (
    <div>
      <div className="flex items-center text-xs uppercase tracking-wider text-muted-foreground">
        {label}
        {tip && <Tip text={tip} />}
      </div>
      <div
        className={cn(
          "mt-1 font-mono text-xl",
          tone === "gold" && "text-primary",
          tone === "green" && "text-success",
          tone === "red" && "text-destructive",
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function Gauge({ cr }: { cr: number }) {
  // map 100% .. 300% onto bar
  const pct = isFinite(cr) ? Math.max(0, Math.min(100, ((cr - 100) / 200) * 100)) : 100;
  const tone =
    !isFinite(cr) || cr >= 200 ? "bg-success" : cr >= 150 ? "bg-warning" : "bg-destructive";
  return (
    <div>
      <div
        className="relative h-3 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-valuemin={100}
        aria-valuemax={300}
        aria-valuenow={isFinite(cr) ? Math.round(cr) : 300}
        aria-label="Collateral ratio"
      >
        <div
          className={cn("h-full rounded-full transition-all", tone)}
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute inset-y-0 w-0.5 bg-destructive"
          style={{ left: "5%" }}
          title="110% liquidation"
        />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>110% liq.</span>
        <span>150%</span>
        <span>200%</span>
        <span>250%</span>
        <span>300%+</span>
      </div>
    </div>
  );
}

export function Field({
  label,
  tip,
  children,
}: {
  label: string;
  tip?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center text-sm text-muted-foreground">
        {label}
        {tip && <Tip text={tip} />}
      </span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border bg-input/30 px-3 py-2.5 font-mono text-foreground outline-none focus:border-ring";

/** Keeps only digits and a single decimal point (max `dp` decimals). */
export function cleanNum(v: string, dp = 8) {
  let s = v.replace(/,/g, ".").replace(/[^0-9.]/g, "");
  const i = s.indexOf(".");
  if (i >= 0)
    s =
      s.slice(0, i + 1) +
      s
        .slice(i + 1)
        .replace(/\./g, "")
        .slice(0, dp);
  if (s.startsWith(".")) s = "0" + s;
  return s.replace(/^0+(?=\d)/, "");
}
