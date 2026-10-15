import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Card } from "@/components/ui-bits";
import { MEZO, num, useStore, type Activity, type ActivityKind } from "@/lib/mezo";
import { getTxReceipt } from "@/lib/onchain";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Activity Log — MezoFlow" },
      {
        name: "description",
        content:
          "Every borrow, collateral change, repayment, Stability Pool action and invoice payment in one ledger.",
      },
      { property: "og:title", content: "Transaction Activity — MezoFlow" },
      {
        property: "og:description",
        content: "A full history of your MezoFlow credit and payment activity with explorer links.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ActivityPage,
});

const LABEL: Record<ActivityKind, string> = {
  borrow: "Borrow MUSD",
  add_collateral: "Add collateral",
  withdraw_collateral: "Withdraw collateral",
  repay: "Repay debt",
  pool_deposit: "Pool deposit",
  pool_withdraw: "Pool withdrawal",
  claim_rewards: "Claim BTC rewards",
  compound_rewards: "Compound rewards",
  invoice_created: "Invoice created",
  invoice_paid: "Invoice payment",
  shield_repay: "Shield auto-repay",
};
const GROUPS: Record<string, ActivityKind[] | null> = {
  All: null,
  Trove: ["borrow", "add_collateral", "withdraw_collateral", "repay", "shield_repay"],
  "Stability Pool": ["pool_deposit", "pool_withdraw", "claim_rewards", "compound_rewards"],
  Payments: ["invoice_created", "invoice_paid"],
};

function TxCell({ a }: { a: Activity }) {
  const [receipt, setReceipt] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (a.onchain) {
      getTxReceipt(a.tx)
        .then((r) => {
          if (!live) return;
          if (r === null) setReceipt("pending / not found");
          else setReceipt(r.status === "0x1" ? "mined ✓" : "failed");
        })
        .catch(() => {
          if (live) setReceipt(null);
        });
    }
    return () => {
      live = false;
    };
  }, [a.tx, a.onchain]);
  return (
    <td className="p-3">
      <a
        className="inline-flex items-center gap-1 font-mono text-xs text-primary underline"
        href={`${MEZO.explorer}/tx/${a.tx}`}
        target="_blank"
        rel="noreferrer"
      >
        {a.tx.slice(0, 10)}…{a.tx.slice(-4)}
        <ExternalLink className="h-3 w-3" aria-hidden="true" />
      </a>
      <div className="mt-1 flex gap-1">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px]",
            a.onchain ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          {a.onchain ? "on-chain" : "simulated"}
        </span>
        {a.onchain && receipt && (
          <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] text-success">
            {receipt}
          </span>
        )}
      </div>
    </td>
  );
}

function ActivityPage() {
  const { activity } = useStore();
  const [g, setG] = useState("All");
  const rows = GROUPS[g] ? activity.filter((a) => GROUPS[g]!.includes(a.kind)) : activity;
  return (
    <Shell>
      <h1 className="text-3xl font-bold">Activity</h1>
      <p className="mt-2 text-muted-foreground">
        Every action you take in MezoFlow, newest first.{" "}
        <span className="font-mono text-xs">on-chain</span> rows were broadcast via your wallet and
        resolve in the explorer; <span className="font-mono text-xs">simulated</span> rows are local
        demo entries.
      </p>
      <div className="mt-6 flex flex-wrap gap-2" role="tablist">
        {Object.keys(GROUPS).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={g === k}
            onClick={() => setG(k)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              g === k
                ? "border-primary bg-primary/10 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {k}
          </button>
        ))}
      </div>
      <Card className="mt-4 overflow-x-auto p-0">
        {rows.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">
            No activity yet. Open a credit line or create a payment link to get started.
          </p>
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr className="border-b">
                <th className="p-3">Time</th>
                <th className="p-3">Action</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3">Status</th>
                <th className="p-3">Transaction</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id + a.ts} className="border-b last:border-0">
                  <td className="whitespace-nowrap p-3 font-mono text-xs text-muted-foreground">
                    {new Date(a.ts).toLocaleString()}
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{LABEL[a.kind]}</div>
                    {a.note && <div className="text-xs text-muted-foreground">{a.note}</div>}
                  </td>
                  <td
                    className={cn(
                      "whitespace-nowrap p-3 text-right font-mono",
                      a.unit === "BTC" ? "text-primary" : "text-success",
                    )}
                  >
                    {num(a.amount, a.unit === "BTC" ? 8 : 2)} {a.unit}
                  </td>
                  <td className="p-3">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs",
                        a.status === "confirmed"
                          ? "bg-success/20 text-success"
                          : "bg-destructive/15 text-destructive",
                      )}
                    >
                      {a.status === "confirmed" ? "Confirmed" : "Failed"}
                    </span>
                  </td>
                  <TxCell a={a} />
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </Shell>
  );
}
