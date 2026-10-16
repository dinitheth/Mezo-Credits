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
      { title: "Past payments — MezoFlow" },
      {
        name: "description",
        content: "Every payment you made through MezoFlow, newest first.",
      },
      { property: "og:title", content: "Past payments — MezoFlow" },
      {
        property: "og:description",
        content: "Your MezoFlow payment history with receipts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ActivityPage,
});

const LABEL: Record<ActivityKind, string> = {
  transfer: "Sent money",
  router_pay: "Paid through the payment contract",
  approve: "Approved spending",
  invoice_paid: "Bill paid",
  borrow: "Borrowed",
  add_collateral: "Added backing",
  withdraw_collateral: "Took back backing",
  repay: "Repaid",
  pool_deposit: "Put into savings",
  pool_withdraw: "Took out of savings",
  claim_rewards: "Collected earnings",
  compound_rewards: "Reinvested earnings",
  invoice_created: "Bill made",
  shield_repay: "Auto-repaid",
};

function TxCell({ a }: { a: Activity }) {
  const [receipt, setReceipt] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    getTxReceipt(a.tx)
      .then((r) => {
        if (!live) return;
        if (r === null) setReceipt("confirming…");
        else setReceipt(r.status === "0x1" ? "done ✓" : "failed");
      })
      .catch(() => {
        if (live) setReceipt(null);
      });
    return () => {
      live = false;
    };
  }, [a.tx]);
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
      {receipt && (
        <div className="mt-1">
          <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] text-success">
            {receipt}
          </span>
        </div>
      )}
    </td>
  );
}

function ActivityPage() {
  const { activity } = useStore();
  return (
    <Shell>
      <h1 className="text-3xl font-bold">Past payments</h1>
      <p className="mt-2 text-muted-foreground">
        Everything you paid through MezoFlow, newest first. Tap a code to see it on Mezo.
      </p>
      <Card className="mt-4 overflow-x-auto p-0">
        {activity.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">
            Nothing yet. Pay a bill and it will show here.
          </p>
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr className="border-b">
                <th className="p-3">When</th>
                <th className="p-3">What</th>
                <th className="p-3 text-right">How much</th>
                <th className="p-3">State</th>
                <th className="p-3">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((a) => (
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
                      {a.status === "confirmed" ? "Done" : "Failed"}
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
