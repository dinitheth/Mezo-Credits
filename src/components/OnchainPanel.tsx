import { useEffect, useState } from "react";
import { MEZO, useStore } from "@/lib/mezo";
import {
  getMezoTokenBalance,
  getMusdBalance,
  mezoTokenAddressFor,
  musdAddressFor,
} from "@/lib/onchain";
import { Card } from "./ui-bits";

/** Your real wallet balances, read straight from the network. */
export function OnchainPanel({ compact }: { compact?: boolean }) {
  const s = useStore();
  const [musd, setMusd] = useState<number | null>(null);
  const [mezoTok, setMezoTok] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const chainId = s.chainId;
  const musdAddr = musdAddressFor(chainId);
  const mezoAddr = mezoTokenAddressFor(chainId);

  const refresh = async () => {
    if (!s.account || !chainId) return;
    setLoading(true);
    setErr(null);
    try {
      const b = musdAddr ? await getMusdBalance(s.account, musdAddr) : null;
      setMusd(b);
      if (!mezoAddr) {
        setMezoTok(null);
        return;
      }
      const mt = await getMezoTokenBalance(s.account, mezoAddr).catch(() => null);
      setMezoTok(mt);
    } catch {
      setErr("Could not read balances. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (s.account && chainId) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.account, chainId]);

  if (!s.account) {
    return (
      <Card className={compact ? "text-sm" : ""}>
        <h2 className="font-semibold">Your money</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect your wallet above to see your money here.
        </p>
      </Card>
    );
  }

  const onMezo = chainId === MEZO.chainId || chainId === 31612;
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-semibold">Your money</h2>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="text-xs text-primary underline disabled:opacity-40"
        >
          {loading ? "Checking…" : "Refresh"}
        </button>
      </div>
      <dl className={`grid gap-3 text-sm ${mezoAddr ? "grid-cols-2" : "grid-cols-1"}`}>
        <div>
          <dt className="text-xs text-muted-foreground">MUSD</dt>
          <dd className="font-mono text-lg">
            {musd === null ? "—" : musd.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </dd>
        </div>
        {mezoAddr && (
          <div>
            <dt className="text-xs text-muted-foreground">MEZO</dt>
            <dd className="font-mono text-lg">
              {mezoTok === null
                ? "—"
                : mezoTok.toLocaleString("en-US", { maximumFractionDigits: 4 })}
            </dd>
          </div>
        )}
      </dl>
      {!onMezo && (
        <p className="mt-2 text-xs text-muted-foreground">
          You are on another network. Switch to Mezo to pay.
        </p>
      )}
      {err && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {err}
        </p>
      )}
    </Card>
  );
}
