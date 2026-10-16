import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/Shell";
import { OnchainPanel } from "@/components/OnchainPanel";
import { Btn, Card, Field, Stat, cleanNum, inputCls } from "@/components/ui-bits";
import { MEZO, logActivity, num, usePriceFeed, useStore } from "@/lib/mezo";
import {
  approveRouter,
  getVaultPosition,
  musdAddressFor,
  vaultAddBacking,
  vaultAddressFor,
  vaultCloseLoan,
  vaultRepay,
  vaultTakeBacking,
  type VaultLoan,
} from "@/lib/onchain";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Your loan — MezoFlow" },
      { name: "description", content: "Your Bitcoin loan and your money in one place." },
      { property: "og:title", content: "Your loan — MezoFlow" },
      { property: "og:description", content: "Backing, owed and safety, live from the pool." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const fmt = (w: bigint, dp = 4) => Number(w) / 1e18;

function useLoan() {
  const s = useStore();
  const vault = vaultAddressFor(s.chainId);
  const [loan, setLoan] = useState<VaultLoan | null>(null);
  const [poolValue, setPoolValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const refresh = async () => {
    if (!vault || !s.account) {
      setLoan(null);
      return;
    }
    setLoading(true);
    try {
      const pos = await getVaultPosition(vault, s.account);
      setLoan(pos.loan.liveOwed > 0n || pos.loan.backing > 0n ? pos.loan : null);
      setPoolValue(Number(pos.poolValue) / 1e18);
    } catch {
      setLoan(null);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vault, s.account]);
  return { vault, loan, poolValue, loading, refresh };
}

function Dashboard() {
  const s = useStore();
  usePriceFeed(true);
  const { vault, loan, poolValue, loading, refresh } = useLoan();
  const [add, setAdd] = useState("");
  const [pay, setPay] = useState("");
  const [take, setTake] = useState("");
  const [close, setClose] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async (
    label: string,
    fn: (account: string, v: string, musd: string) => Promise<string>,
  ) => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      if (!s.account) throw new Error("Connect your wallet first.");
      if (!vault) throw new Error("The pool is not open yet.");
      const musd = musdAddressFor(s.chainId);
      if (!musd) throw new Error("Switch to the Mezo network in your wallet first.");
      const hash = await fn(s.account, vault, musd);
      await refresh();
      setMsg(`${label} · receipt ${hash.slice(0, 12)}…`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "That did not go through. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const doAdd = () => {
    const a = Number(add) || 0;
    if (!a) return;
    void run(`Locked ${a} more Bitcoin`, async (account, v) => {
      const hash = await vaultAddBacking(v, account, add);
      logActivity("add_collateral", a, "BTC", "Added to your loan", hash);
      return hash;
    });
    setAdd("");
  };
  const doPay = () => {
    const a = Number(pay) || 0;
    if (!a) return;
    void run(`Paid ${num(a, 2)} MUSD`, async (account, v, musd) => {
      await approveRouter(musd, v, pay, account).catch((e) => {
        if (!/rejected|denied/i.test(e instanceof Error ? e.message : String(e))) throw e;
        throw new Error("You said no in your wallet. Nothing moved.");
      });
      const hash = await vaultRepay(v, account, pay);
      logActivity("repay", a, "MUSD", "Paid down your loan", hash);
      return hash;
    });
    setPay("");
  };
  const doTake = () => {
    const a = Number(take) || 0;
    if (!a) return;
    void run(`Took back ${a} Bitcoin`, async (account, v) => {
      const hash = await vaultTakeBacking(v, account, take);
      logActivity("withdraw_collateral", a, "BTC", "Took back from your loan", hash);
      return hash;
    });
    setTake("");
  };
  const doClose = () => {
    if (!/^0x[0-9a-fA-F]{40}$/.test(close)) {
      setErr("Paste the borrower's wallet address first.");
      return;
    }
    void run("Closed that loan", async (account, v, musd) => {
      const pos = await getVaultPosition(v, close);
      const owed = Number(pos.loan.liveOwed) / 1e18;
      if (owed <= 0) throw new Error("That wallet has no loan.");
      if (Number(pos.loan.ratio) >= 110)
        throw new Error("That loan is still safe. Only loans under 110% can close.");
      await approveRouter(musd, v, owed.toFixed(2), account).catch((e) => {
        if (!/rejected|denied/i.test(e instanceof Error ? e.message : String(e))) throw e;
        throw new Error("You said no in your wallet. Nothing moved.");
      });
      const hash = await vaultCloseLoan(v, account, close);
      logActivity("repay", owed, "MUSD", "Closed someone's unsafe loan, kept their Bitcoin", hash);
      return hash;
    });
    setClose("");
  };

  const ratio = loan ? Number(loan.ratio) : 0;
  const danger = loan !== null && ratio < 150;

  return (
    <Shell>
      <section className="mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Your loan</h1>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="text-sm text-primary underline disabled:opacity-40"
          >
            {loading ? "Checking…" : "Refresh"}
          </button>
        </div>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Your locked Bitcoin, what you owe, and how safe it is — read live from our pool contract.
        </p>
      </section>

      {!s.account ? (
        <Card className="flex flex-col items-start gap-4 md:flex-row md:items-center">
          <div className="flex-1">
            <h2 className="text-xl font-semibold">Connect to see your loan</h2>
            <p className="text-sm text-muted-foreground">Connect your wallet up top.</p>
          </div>
          <Link to="/borrow">
            <Btn variant="ghost">Plan a loan</Btn>
          </Link>
        </Card>
      ) : !vault ? (
        <Card>
          <h2 className="text-xl font-semibold">The pool opens at launch</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Loans start as soon as our pool contract is live on Mezo.
          </p>
        </Card>
      ) : !loan ? (
        <Card className="flex flex-col items-start gap-4 md:flex-row md:items-center">
          <div className="flex-1">
            <h2 className="text-xl font-semibold">No loan yet</h2>
            <p className="text-sm text-muted-foreground">
              Lock Bitcoin and borrow MUSD in one step on the Plan page.
            </p>
          </div>
          <Link to="/borrow">
            <Btn>Plan a loan</Btn>
          </Link>
          <Link to="/pay">
            <Btn variant="ghost">Get paid</Btn>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <h2 className="mb-4 font-semibold">Your loan right now</h2>
            <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
              <Stat label="Locked Bitcoin" value={`${num(fmt(loan.backing), 6)}`} tone="gold" />
              <Stat label="You owe" value={`${num(fmt(loan.liveOwed), 2)} MUSD`} />
              <Stat
                label="Safety"
                value={ratio > 1000000 ? "—" : `${ratio.toFixed(0)}%`}
                tone={danger ? "red" : "green"}
              />
              <Stat label="Your savings share" value={`${num(poolValue, 2)} MUSD`} tone="green" />
            </div>
            {danger && (
              <div
                role="alert"
                className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
              >
                Your safety is under 150%. Add Bitcoin or pay down MUSD before it nears 110% — under
                that, anyone can close your loan.
              </div>
            )}
            <p className="mt-4 break-all font-mono text-[11px] text-muted-foreground">
              Pool contract {vault} ·{" "}
              <a
                className="underline"
                href={`${MEZO.explorer}/address/${vault}`}
                target="_blank"
                rel="noreferrer"
              >
                check it on Mezo
              </a>
            </p>
          </Card>
          <Card>
            <h2 className="mb-4 font-semibold">Do something</h2>
            <div className="space-y-4">
              <Field label="Lock more Bitcoin">
                <div className="flex gap-2">
                  <input
                    className={inputCls}
                    inputMode="decimal"
                    value={add}
                    onChange={(e) => setAdd(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="0.0"
                  />
                  <Btn onClick={doAdd} disabled={busy}>
                    Add
                  </Btn>
                </div>
              </Field>
              <Field label="Pay down MUSD">
                <div className="flex gap-2">
                  <input
                    className={inputCls}
                    inputMode="decimal"
                    value={pay}
                    onChange={(e) => setPay(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="0.00"
                  />
                  <Btn variant="green" onClick={doPay} disabled={busy}>
                    Pay
                  </Btn>
                </div>
              </Field>
              <Field label="Take back Bitcoin">
                <div className="flex gap-2">
                  <input
                    className={inputCls}
                    inputMode="decimal"
                    value={take}
                    onChange={(e) => setTake(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="0.0"
                  />
                  <Btn variant="ghost" onClick={doTake} disabled={busy}>
                    Take
                  </Btn>
                </div>
              </Field>
              {msg && (
                <p className="text-xs text-success" aria-live="polite">
                  {msg}
                </p>
              )}
              {err && (
                <p role="alert" className="text-xs text-destructive">
                  {err}
                </p>
              )}
            </div>
          </Card>
          <Card className="lg:col-span-3">
            <h2 className="font-semibold">Close an unsafe loan</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Loans under 110% can be closed by anyone: you pay what they owe, you keep their
              Bitcoin. Paste their wallet address below.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                className={inputCls}
                value={close}
                onChange={(e) => setClose(e.target.value.trim())}
                placeholder="0x…"
              />
              <Btn variant="ghost" onClick={doClose} disabled={busy}>
                Close it
              </Btn>
            </div>
          </Card>
        </div>
      )}

      <div className="mt-4">
        <OnchainPanel />
      </div>
    </Shell>
  );
}
