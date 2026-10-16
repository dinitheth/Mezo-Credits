import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Shell } from "@/components/Shell";
import { BtcWord } from "@/components/BitcoinMark";
import { Btn } from "@/components/ui-bits";
import { MIN_CR, TIERS, usd, usePriceFeed, useStore } from "@/lib/mezo";
import statue from "@/assets/hero-statue.png";
import { BitcoinMark } from "@/components/BitcoinMark";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MezoFlow — Borrow dollars against your Bitcoin" },
      {
        name: "description",
        content:
          "Lock BTC, mint dollar-pegged MUSD, and settle invoices instantly with Pay-with-Credit links on Mezo.",
      },
      { property: "og:title", content: "MezoFlow — Borrow dollars against your Bitcoin" },
      {
        property: "og:description",
        content: "BTC credit lines and Pay-with-Credit checkout on Mezo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

const rows: { title: string; body: ReactNode; to: "/borrow" | "/pay" | "/earn"; cta: string }[] = [
  {
    title: "Borrow planner",
    body: "See what your Bitcoin could borrow, then borrow for real in the Mezo app.",
    to: "/borrow",
    cta: "Plan a loan",
  },
  {
    title: "Payment links",
    body: "Send a bill as a link. Your customer pays it from their wallet in one step.",
    to: "/pay",
    cta: "Make a link",
  },
  {
    title: "Grow savings",
    body: "Put MUSD in Mezo's shared pool and earn Bitcoin over time.",
    to: "/earn",
    cta: "How it grows",
  },
];

function Landing() {
  const s = useStore();
  usePriceFeed(true);
  const paid = s.invoices.filter((i) => i.paid).length;
  const perBtc = s.btcPrice > 0 ? (s.btcPrice / (TIERS[1]?.cr ?? 200)) * 100 : 0;

  return (
    <Shell>
      {/* Hero */}
      <section className="grid items-center gap-12 py-8 md:grid-cols-[1.15fr_1fr] md:py-14">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            MezoFlow · Money on Bitcoin
          </p>
          <h1 className="mt-5 text-5xl font-bold leading-[1.02] tracking-tight md:text-7xl">
            Don't sell your
            <BtcWord text="Bitcoin." markClassName="h-[0.8em] w-[0.8em] shrink-0" />
            <br />
            <span className="text-primary">Spend against it.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg text-muted-foreground">
            Ask for dollars (MUSD) with a link, and get paid straight into your wallet. Plan what
            your Bitcoin could borrow, too.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link to="/pay">
              <Btn className="gap-2 px-6 py-3 text-base">
                Make a payment link <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Btn>
            </Link>
            <Link
              to={paid > 0 ? "/dashboard" : "/borrow"}
              className="text-sm font-medium underline decoration-primary underline-offset-4"
            >
              {paid > 0 ? "Your home" : "or plan a loan"}
            </Link>
          </div>

          <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-4 border-t pt-6">
            <div>
              <dt className="text-xs text-muted-foreground">Bitcoin right now</dt>
              <dd className="font-mono text-xl font-semibold">
                {s.priceLive && s.btcPrice > 0 ? usd(s.btcPrice) : "loading…"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Borrow per 1 Bitcoin</dt>
              <dd className="font-mono text-xl font-semibold">{perBtc > 0 ? usd(perBtc) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Safety line</dt>
              <dd className="font-mono text-xl font-semibold">{MIN_CR}%</dd>
            </div>
          </dl>
        </div>
        <HeroStatue />
      </section>

      {/* Product rows */}
      <section className="mt-20 border-t">
        {rows.map(({ title, body, to, cta }, i) => (
          <Link
            key={title}
            to={to}
            className="group grid items-baseline gap-4 border-b py-8 transition-colors hover:bg-secondary/40 md:grid-cols-[80px_1fr_2fr_auto] md:px-2"
          >
            <span className="font-mono text-sm text-muted-foreground">0{i + 1}</span>
            <h3 className="text-2xl font-semibold tracking-tight">{title}</h3>
            <p className="max-w-lg text-muted-foreground">{body}</p>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
              {cta}{" "}
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </section>

      {/* Safety strip */}
      <section className="mt-20 grid gap-10 md:grid-cols-2">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
          Know your safety before you borrow.
        </h2>
        <div className="space-y-4 text-muted-foreground">
          <p>
            The planner shows what each safety level lets you borrow and the price where the loan
            would close. Below 150% is risky; at {MIN_CR}% Mezo closes the loan.
          </p>
          <div className="flex gap-2">
            {TIERS.map((t) => (
              <span
                key={t.cr}
                className="rounded-full border px-3 py-1 font-mono text-xs text-foreground"
              >
                {t.label} {t.cr}%
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mt-20 flex flex-col items-start justify-between gap-6 rounded-2xl bg-primary px-8 py-10 text-primary-foreground md:flex-row md:items-center">
        <h2 className="text-2xl font-bold md:text-3xl">Get paid in a minute.</h2>
        <Link to="/pay">
          <Btn
            variant="ghost"
            className="gap-2 bg-background px-6 py-3 text-base text-foreground hover:bg-background/90"
          >
            Get started <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Btn>
        </Link>
      </section>
    </Shell>
  );
}

/** Coins circling AROUND the statue: the `circle-around` keyframe (styles.css)
 *  moves each coin side to side, scaling it up in front of the statue
 *  (z-index 30) and shrinking it behind (z-index 0). */
const ORBITERS: { r: string; size: string; dur: string; delay: string; top: string }[] = [
  { r: "180px", size: "h-11 w-11", dur: "11s", delay: "0s", top: "22%" },
  { r: "200px", size: "h-8 w-8", dur: "15s", delay: "-5s", top: "45%" },
  { r: "170px", size: "h-12 w-12", dur: "13s", delay: "-9s", top: "62%" },
  { r: "190px", size: "h-7 w-7", dur: "17s", delay: "-13s", top: "80%" },
];

function HeroStatue() {
  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-[420px]">
      <img
        src={statue}
        width={1024}
        height={1280}
        alt="Marble Greek warrior statue"
        className="relative z-10 h-full w-full object-contain drop-shadow-2xl"
      />
      {ORBITERS.map((o, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2"
          style={{ top: o.top }}
        >
          <div
            className="animate-circle-around"
            style={
              {
                "--r": o.r,
                animationDuration: o.dur,
                animationDelay: o.delay,
              } as React.CSSProperties
            }
          >
            <BitcoinMark className={`${o.size} -translate-x-1/2 drop-shadow-lg`} />
          </div>
        </div>
      ))}
    </div>
  );
}
