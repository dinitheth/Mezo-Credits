import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/Shell";
import { OnchainPanel } from "@/components/OnchainPanel";
import { Btn, Card } from "@/components/ui-bits";
import { usePriceFeed } from "@/lib/mezo";

export const Route = createFileRoute("/earn")({
  head: () => ({
    meta: [
      { title: "Grow your MUSD — MezoFlow" },
      { name: "description", content: "Put your MUSD to work in Mezo's savings pool." },
      { property: "og:title", content: "Grow your MUSD — MezoFlow" },
      { property: "og:description", content: "How the Mezo savings pool pays you in Bitcoin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Earn,
});

function Earn() {
  usePriceFeed(false);

  return (
    <Shell>
      <h1 className="text-3xl font-bold">Grow your money</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Mezo has a shared savings pool. You put in MUSD, and when other loans close out, you earn
        Bitcoin. Your balance is below — deposits happen in the Mezo app.
      </p>

      <div className="mt-6">
        <OnchainPanel />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="space-y-3">
          <h2 className="font-semibold">How it pays you</h2>
          <p className="text-sm text-muted-foreground">
            When a loan falls too far, the pool covers it and shares that loan&apos;s Bitcoin
            between everyone in the pool.
          </p>
          <a href="https://mezo.org/feature/earn" target="_blank" rel="noreferrer">
            <Btn>Open the Mezo app</Btn>
          </a>
        </Card>
        <Card className="space-y-3">
          <h2 className="font-semibold">What you need</h2>
          <p className="text-sm text-muted-foreground">
            MUSD in your wallet on Mezo. Get some by borrowing, or ask someone to pay you with a
            MezoFlow link.
          </p>
        </Card>
        <Card className="space-y-3">
          <h2 className="font-semibold">MEZO token</h2>
          <p className="text-sm text-muted-foreground">
            MEZO is Mezo&apos;s own coin. It cuts your fees, lets you vote on changes, and can boost
            what you earn. Your balance shows above when it&apos;s available on your network.
          </p>
        </Card>
      </div>
    </Shell>
  );
}
