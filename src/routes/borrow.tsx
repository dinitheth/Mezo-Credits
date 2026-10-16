import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/Shell";
import { BtcWord } from "@/components/BitcoinMark";
import { CreditForm } from "@/components/CreditForm";
import { OnchainPanel } from "@/components/OnchainPanel";
import { Btn, Card } from "@/components/ui-bits";

export const Route = createFileRoute("/borrow")({
  head: () => ({
    meta: [
      { title: "Borrow Planner — MezoFlow" },
      {
        name: "description",
        content: "See how much you could borrow against Bitcoin at three safety levels.",
      },
      { property: "og:title", content: "Borrow Planner — MezoFlow" },
      {
        property: "og:description",
        content: "Plan a Bitcoin-backed loan with live prices.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Borrow,
});

function Borrow() {
  return (
    <Shell>
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <h1 className="text-3xl font-bold">Borrow planner</h1>
          <p className="mt-2 text-muted-foreground">
            See what your Bitcoin could borrow in MUSD, Mezo&apos;s
            <BtcWord text="Bitcoin-backed" /> dollar. Then put MUSD to work right here.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
            <li>
              <b className="text-foreground">Below 110% the loan closes.</b> Stay well above it.
            </li>
            <li>
              <b className="text-foreground">Fixed rate.</b> Mezo locks your rate when you borrow.
            </li>
            <li>
              <b className="text-foreground">Minimum 1,800 MUSD</b> per loan.
            </li>
          </ul>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/pay">
              <Btn>Send a payment link</Btn>
            </Link>
            <Link to="/earn">
              <Btn variant="ghost">Grow savings</Btn>
            </Link>
          </div>
        </div>
        <Card className="lg:col-span-3">
          <CreditForm />
        </Card>
      </div>
      <div className="mt-4">
        <OnchainPanel />
      </div>
    </Shell>
  );
}
