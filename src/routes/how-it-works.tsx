import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/Shell";
import { Btn, Card } from "@/components/ui-bits";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How MezoFlow works — Architecture" },
      {
        name: "description",
        content:
          "MezoFlow architecture: Router, Troves, Stability Pool, EIP-712 signatures and Pay with Credit settlement.",
      },
      { property: "og:title", content: "How MezoFlow works" },
      {
        property: "og:description",
        content: "The architecture behind Bitcoin-backed credit and instant MUSD payments.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HowItWorks,
});

const PARTS = [
  {
    n: "01",
    title: "MezoFlow Router",
    body: "One entry point that batches multi-step actions into a single transaction: deposit BTC, open or adjust a Trove, mint MUSD and forward it to the Stability Pool or an invoice recipient. You sign once instead of approving every call.",
    flow: ["Wallet", "Router", "Trove Manager", "MUSD", "Pool / Recipient"],
  },
  {
    n: "02",
    title: "Troves & collateral ratio",
    body: "A Trove holds your BTC and records your MUSD debt. Collateral ratio = BTC value ÷ debt. Below 110% the Trove can be liquidated, so MezoFlow offers 250%, 200% and 150% presets and warns you below 150%.",
    flow: ["BTC in", "CR check", "Mint MUSD", "Health score"],
  },
  {
    n: "03",
    title: "Stability Pool",
    body: "MUSD deposited in the pool repays the debt of liquidated Troves. In return depositors receive that Trove's BTC at a discount, which is your yield. You can claim it to your wallet or compound it into your own collateral.",
    flow: ["Deposit MUSD", "Absorb liquidation", "Earn BTC", "Claim / Compound"],
  },
  {
    n: "04",
    title: "EIP-712 delegated signatures",
    body: "Typed, readable signatures authorise one exact action, e.g. 'pay invoice #ab12 for 250 MUSD, max 0.008 BTC'. The Router checks signature, nonce and deadline, so a merchant or relayer can submit it without ever holding your funds.",
    flow: ["Typed data", "User signs", "Router verifies", "Executes once"],
  },
  {
    n: "05",
    title: "Dual-token utility",
    body: "MUSD is the Bitcoin-backed dollar for borrowing, invoices and the pool. MEZO is the network token for fee discounts, governance and boosted incentives. BTC stays the collateral and the reward asset.",
    flow: ["BTC collateral", "MUSD credit", "MEZO utility"],
  },
  {
    n: "06",
    title: "Bridging both tracks",
    body: "Track 1 (credit) is Troves, ratios, liquidations and the pool. Track 2 (payments) is invoices, QR links and checkout. Pay with Credit joins them: the payer's BTC is locked and MUSD minted in the same step that pays the merchant.",
    flow: ["Track 1: Credit", "Pay with Credit", "Track 2: Settlement"],
  },
];

function HowItWorks() {
  return (
    <Shell>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Architecture
      </p>
      <h1 className="mt-3 text-4xl font-bold md:text-5xl">How MezoFlow works</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        From a BTC deposit to a settled invoice — every layer of the system, in order.
      </p>
      <div className="mt-10 space-y-4">
        {PARTS.map((p) => (
          <Card key={p.n} className="grid gap-4 md:grid-cols-[80px_1fr]">
            <span className="font-mono text-3xl font-bold text-primary">{p.n}</span>
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">{p.title}</h2>
              <p className="leading-relaxed text-muted-foreground">{p.body}</p>
              <div className="flex flex-wrap items-center gap-2">
                {p.flow.map((f, i) => (
                  <span key={f} className="flex items-center gap-2">
                    <span className="rounded-md border bg-muted px-2 py-1 font-mono text-xs">
                      {f}
                    </span>
                    {i < p.flow.length - 1 && (
                      <span className="text-primary" aria-hidden="true">
                        →
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        In this version contract calls are simulated in your browser; wallet connection and network
        switching are real.
      </p>
      <Link to="/borrow" className="mt-6 inline-block">
        <Btn>Open a credit line</Btn>
      </Link>
    </Shell>
  );
}
