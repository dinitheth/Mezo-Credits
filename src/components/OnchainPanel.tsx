import { useEffect, useState } from "react";
import { MEZO, useStore } from "@/lib/mezo";
import { getBlockNumber, getMezoTokenBalance, getMusdBalance, mezoTokenAddressFor, musdAddressFor } from "@/lib/onchain";
import { Card } from "./ui-bits";

/**
 * Real on-chain reads (Wave 1): wallet chain + block number + ERC-20 MUSD /
 * MEZO balances via `eth_call`. Simulated Trove/pool figures stay in the
 * route cards; this panel is the genuine chain leg and never touches `MEZO`
 * RPC constants.
 */
export function OnchainPanel({ compact }: { compact?: boolean }) {
  const s = useStore();
  const [musd, setMusd] = useState<number | null>(null);
  const [mezoTok, setMezoTok] = useState<number | null>(null);
  const [block, setBlock] = useState<string | null>(null);
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
      const [b, blk] = await Promise.all([
        musdAddr ? getMusdBalance(s.account, musdAddr) : Promise.resolve(null),
        getBlockNumber().catch(() => null),
      ]);
      setMusd(b);
      setBlock(blk === null ? null : blk.toString());
      const mt = await getMezoTokenBalance(s.account, mezoAddr).catch(() => null);
      setMezoTok(mt);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
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
        <h2 className="font-semibold">On-chain balances</h2>
        <p className="mt-1 text-sm text-muted-foreground">Connect a wallet to read real MUSD / MEZO balances via <span className="font-mono">eth_call</span>.</p>
      </Card>
    );
  }

  const onMezo = chainId === MEZO.chainId || chainId === 31612;
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-semibold">On-chain balances · real reads</h2>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="text-xs text-primary underline disabled:opacity-40">
          {loading ? "Reading…" : "Refresh"}
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-3 font-mono text-sm md:grid-cols-4">
        <div><dt className="font-sans text-xs text-muted-foreground">Chain</dt><dd>{chainId ?? "—"}{onMezo ? " · Mezo" : ""}</dd></div>
        <div><dt className="font-sans text-xs text-muted-foreground">Block</dt><dd>{block ?? "—"}</dd></div>
        <div><dt className="font-sans text-xs text-muted-foreground">MUSD (wallet)</dt><dd>{musd === null ? (musdAddr ? "—" : "no MUSD on this chain") : `${musd.toLocaleString("en-US", { maximumFractionDigits: 2 })}`}</dd></div>
        <div><dt className="font-sans text-xs text-muted-foreground">MEZO (wallet)</dt><dd>{mezoTok === null ? (mezoAddr ? "—" : "set VITE_MEZO_TOKEN_*") : `${mezoTok.toLocaleString("en-US", { maximumFractionDigits: 4 })}`}</dd></div>
      </dl>
      {musdAddr && <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">MUSD {musdAddr}</p>}
      {mezoAddr && <p className="break-all font-mono text-[11px] text-muted-foreground">MEZO {mezoAddr}</p>}
      {!onMezo && <p className="mt-2 text-xs text-muted-foreground">Switch to Mezo testnet (31611) for the Wave 1 MUSD write path. Reads above are still real for the connected chain.</p>}
      {err && <p role="alert" className="mt-2 text-xs text-destructive">{err}</p>}
      <p className="mt-2 text-[11px] text-muted-foreground">Trove collateral/debt/pool cards remain simulated in-browser (see README); this panel + checkout transfers are the live chain legs.</p>
    </Card>
  );
}
