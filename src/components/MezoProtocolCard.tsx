import { useEffect, useState } from "react";
import { Card, Stat } from "./ui-bits";
import { num, useStore } from "@/lib/mezo";
import {
  getMezoSystem,
  getMezoTrove,
  mezoProtocolFor,
  type MezoSystem,
  type MezoTrove,
} from "@/lib/onchain";

const btc = (w: bigint, dp = 4) => num(Number(w) / 1e18, dp);
const musd = (w: bigint, dp = 2) => num(Number(w) / 1e18, dp);
const percent = (w: bigint) => {
  const n = Number(w) / 1e16;
  if (!Number.isFinite(n) || n > 1_000_000) return "—";
  return `${n.toFixed(0)}%`;
};

/**
 * Real reads from Mezo's own PriceFeed and TroveManager. This is the protocol
 * MezoFlow prices against; it is not our lending pool.
 */
export function MezoProtocolCard({ showTrove = true }: { showTrove?: boolean }) {
  const s = useStore();
  const chainId = s.chainId ?? 31611;
  const protocol = mezoProtocolFor(chainId);
  const [system, setSystem] = useState<MezoSystem | null>(null);
  const [trove, setTrove] = useState<MezoTrove | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    if (!protocol) {
      setSystem(null);
      setTrove(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    void Promise.all([
      getMezoSystem(chainId),
      s.account ? getMezoTrove(chainId, s.account) : Promise.resolve(null),
    ])
      .then(([nextSystem, nextTrove]) => {
        if (!live) return;
        setSystem(nextSystem);
        setTrove(nextTrove);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [chainId, protocol, s.account]);

  if (!protocol) return null;

  return (
    <Card className="mt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Mezo, live</h2>
        <span className="text-[11px] text-muted-foreground">
          {loading ? "Checking…" : "Read from Mezo's own contracts"}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Our pool uses Mezo&apos;s Bitcoin price. These numbers come from Mezo&apos;s price feed and
        loan book.
      </p>

      {system ? (
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat
            label="Bitcoin price"
            value={`$${num(Number(system.price) / 1e18, 0)}`}
            tone="gold"
          />
          <Stat label="Bitcoin locked on Mezo" value={`${btc(system.totalCollateral)} BTC`} />
          <Stat label="MUSD borrowed on Mezo" value={`${musd(system.totalDebt)} MUSD`} />
          <Stat
            label="Mezo safety"
            value={percent(system.tcr)}
            tone={Number(system.tcr) < 1.5e18 ? "red" : "green"}
            tip="All Mezo loans compared with all Bitcoin locked there. Below 100% is unsafe."
          />
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Mezo&apos;s price is not available right now. Borrowing waits until it is fresh again.
        </p>
      )}

      {showTrove && s.account && (
        <div className="mt-5 rounded-lg border p-4">
          <h3 className="font-semibold">Your Mezo loan</h3>
          {trove ? (
            <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat label="Bitcoin locked" value={`${btc(trove.collateral, 6)} BTC`} tone="gold" />
              <Stat label="MUSD owed" value={`${musd(trove.debt)} MUSD`} />
              <Stat
                label="Safety"
                value={percent(trove.ratio)}
                tone={Number(trove.ratio) < 1.5e18 ? "red" : "green"}
              />
              <Stat label="Yearly cost" value={`${(trove.rate / 100).toFixed(2)}%`} />
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              This wallet has no open Mezo loan. MezoFlow&apos;s pool is separate.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
