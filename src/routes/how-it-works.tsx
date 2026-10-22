import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/Shell";
import { Btn, Card } from "@/components/ui-bits";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How MezoFlow works" },
      { name: "description", content: "What MezoFlow does, step by step." },
      { property: "og:title", content: "How MezoFlow works" },
      { property: "og:description", content: "Bills, payments and borrowing on Mezo." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HowItWorks,
});

const PARTS = [
  {
    n: "01",
    title: "Make a bill",
    body: "Type an amount and what it is for. You get a link and a code to scan. Share it anywhere.",
  },
  {
    n: "02",
    title: "People pay from their wallet",
    body: "The link opens a simple pay page. They approve in their wallet and the money goes straight to you.",
  },
  {
    n: "03",
    title: "Bigger bills use the payment contract",
    body: "For larger amounts, they approve once and a small on-Mezo program moves the money and keeps a public receipt anyone can check.",
  },
  {
    n: "04",
    title: "Lock Bitcoin, borrow MUSD",
    body: "Pick one of three safety levels and borrow straight from our pool. Your Bitcoin stays locked until you pay the MUSD back.",
  },
  {
    n: "05",
    title: "Grow savings",
    body: "Put MUSD in the shared pool and earn part of the fee borrowers pay. Take it back whenever the pool has cash.",
  },
  {
    n: "06",
    title: "MUSD and MEZO",
    body: "MUSD is the dollar you borrow, bill and pay with. MEZO is Mezo's own coin for lower fees and votes. Bitcoin stays the backing behind it all.",
  },
];

function HowItWorks() {
  return (
    <Shell>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Guide</p>
      <h1 className="mt-3 text-4xl font-bold md:text-5xl">How MezoFlow works</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Bills, payments, borrowing and savings on Mezo — nothing else.
      </p>
      <div className="mt-10 space-y-4">
        {PARTS.map((p) => (
          <Card key={p.n} className="grid gap-4 md:grid-cols-[80px_1fr]">
            <span className="font-mono text-3xl font-bold text-primary">{p.n}</span>
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">{p.title}</h2>
              <p className="leading-relaxed text-muted-foreground">{p.body}</p>
            </div>
          </Card>
        ))}
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        Every payment runs through your wallet on the Mezo network. Nothing here moves money by
        itself.
      </p>
      <Link to="/pay" className="mt-6 inline-block">
        <Btn>Make a payment link</Btn>
      </Link>
    </Shell>
  );
}
