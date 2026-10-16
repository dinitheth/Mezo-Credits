import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/Shell";
import { BtcWord } from "@/components/BitcoinMark";
import { OnchainPanel } from "@/components/OnchainPanel";
import { Btn, Card, Stat } from "@/components/ui-bits";
import { num, short, usd, usePriceFeed, useStore } from "@/lib/mezo";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "MezoFlow Dashboard — Your money" },
      {
        name: "description",
        content: "Your balances, payment links and recent payments in one place.",
      },
      { property: "og:title", content: "MezoFlow Dashboard — Your money" },
      { property: "og:description", content: "Balances, payment links and recent payments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const s = useStore();
  usePriceFeed(true);
  const open = s.invoices.filter((i) => !i.paid).length;
  const paid = s.invoices.filter((i) => i.paid).length;

  return (
    <Shell>
      <section className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
          Your
          <BtcWord text="Bitcoin," markClassName="h-[0.8em] w-[0.8em] shrink-0" />{" "}
          <span className="bg-gold bg-clip-text text-transparent">working</span>.{" "}
          <span className="text-success">Instantly.</span>
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          See your money, send payment links, and pay bills from your wallet.
        </p>
      </section>

      {!s.account ? (
        <Card className="flex flex-col items-start gap-4 md:flex-row md:items-center">
          <div className="flex-1">
            <h2 className="text-xl font-semibold">Connect to begin</h2>
            <p className="text-sm text-muted-foreground">
              Connect your wallet up top. Your balances will show here.
            </p>
          </div>
          <Link to="/pay">
            <Btn variant="ghost">Create a payment link</Btn>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <OnchainPanel />
          </div>
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">At a glance</h2>
              <span className="font-mono text-xs text-muted-foreground">
                Bitcoin {s.priceLive && s.btcPrice > 0 ? usd(s.btcPrice) : "loading…"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-5">
              <Stat label="Your address" value={short(s.account)} />
              <Stat label="Open payment links" value={`${open}`} tone="gold" />
              <Stat label="Bills paid" value={`${paid}`} tone="green" />
              <Stat label="Past payments" value={`${s.activity.length}`} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/pay">
                <Btn variant="ghost">New payment link</Btn>
              </Link>
              <Link to="/activity">
                <Btn variant="ghost">See all payments</Btn>
              </Link>
            </div>
          </Card>
        </div>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          ["1. Make a link", "Ask for MUSD with a short link and a code people can scan."],
          ["2. Share it", "Send it anywhere. It opens a simple pay page."],
          [
            "3. Get paid",
            "Money lands straight in your wallet. Every payment is listed under Activity.",
          ],
        ].map(([t, d]) => (
          <Card key={t}>
            <h3 className="font-semibold text-primary">{t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
          </Card>
        ))}
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        Owe {num(open, 0)} open {open === 1 ? "bill" : "bills"} · {num(paid, 0)} settled.
      </p>
    </Shell>
  );
}
