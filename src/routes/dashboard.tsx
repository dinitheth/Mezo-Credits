import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/Shell";
import { OnchainPanel } from "@/components/OnchainPanel";
import { Btn, Card, Field, Stat, cleanNum, inputCls } from "@/components/ui-bits";
import { MEZO, logActivity, num, setActivityStatus, usePriceFeed, useStore } from "@/lib/mezo";
import { friendly } from "@/lib/errors";
import {
  approveRouter,
  didSucceed,
  getBtcBalance,
  getMusdBalance,
  getVaultPosition,
  musdAddressFor,
  vaultAddBacking,
  vaultAddressFor,
  vaultCloseLoan,
  vaultRepay,
  vaultTakeBacking,
  waitForReceipt,
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
  const vault = vaultAddressFor(s.chainId ?? 31611);
  const onMezo = !s.chainId || s.chainId === 31611 || s.chainId === 31612;
  const [loan, setLoan] = useState<VaultLoan | null>(null);
  const [poolValue, setPoolValue] = useState(0);
  const [walletBtc, setWalletBtc] = useState<number | null>(null);
  const [walletMusd, setWalletMusd] = useState<number | null>(null);
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
      const btc = await getBtcBalance(s.account).catch(() => null);
      setWalletBtc(btc);
      const musd = musdAddressFor(s.chainId);
      if (musd) {
        const held = await getMusdBalance(s.account, musd).catch(() => null);
        setWalletMusd(held);
      }
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
  return { vault, onMezo, loan, poolValue, walletBtc, walletMusd, loading, refresh };
}

function Dashboard() {
  const s = useStore();
  usePriceFeed(true);
  const { vault, onMezo, loan, poolValue, walletBtc, walletMusd, loading, refresh } = useLoan();
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
      void didSucceed(hash).then((ok) => {
        if (ok === false) {
          setActivityStatus(hash, "failed");
          setMsg("That did not go through (see Past payments). Nothing moved.");
        }
      });
    } catch (e) {
      setErr(friendly(e));
    } finally {
      setBusy(false);
    }
  };

  const approveFirst = async (musd: string, v: string, account: string, amount: string) => {
    setMsg("Step 1 of 2: approving in your wallet…");
    const approval = await approveRouter(musd, v, amount, account);
    setMsg("Waiting on step 1…");
    await waitForReceipt(approval);
    setMsg("Step 2 of 2: sending it…");
  };

  const doAdd = () => {
    const a = Number(add) || 0;
    if (!a) return;
    if (walletBtc !== null && a > walletBtc) {
      setErr(`You have ${num(walletBtc, 4)} BTC in your wallet.`);
      return;
    }
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
      const held = await getMusdBalance(account, musd).catch(() => 0);
      if (held < a) throw new Error(`You hold ${held} MUSD — less than this payment.`);
      await approveFirst(musd, v, account, pay);
      const hash = await vaultRepay(v, account, pay);
      logActivity("repay", a, "MUSD", "Paid down your loan", hash);
      return hash;
    });
    setPay("");
  };
  const doTake = () => {
    const a = Number(take) || 0;
    if (!a) return;
    if (a > takeMax) {
      setErr(
        `That would push your safety under 150%. You can take back up to ${num(takeMax, 6)} BTC.`,
      );
      return;
    }
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
      const held = await getMusdBalance(account, musd).catch(() => 0);
      if (held < owed) throw new Error(`You hold ${held} MUSD — closing needs ${num(owed, 2)}.`);
      await approveFirst(musd, v, account, owed.toFixed(2));
      const hash = await vaultCloseLoan(v, account, close);
      logActivity("repay", owed, "MUSD", "Closed someone's unsafe loan, kept their Bitcoin", hash);
      return hash;
    });
    setClose("");
  };

  const ratio = loan ? Number(loan.ratio) : 0;
  const danger = loan !== null && ratio < 150;
  const takeMax =
    loan && s.btcPrice > 0
      ? Math.max(0, fmt(loan.backing) - (fmt(loan.liveOwed) * 1.5) / s.btcPrice)
      : 0;

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
      ) : !onMezo ? (
        <Card>
          <h2 className="text-xl font-semibold">Wrong network</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You are on another network. Switch to Mezo in your wallet to see your loan.
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
              <div>
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
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Available in your wallet:{" "}
                  <span className="font-mono text-foreground">
                    {walletBtc === null ? "…" : `${num(walletBtc, 4)} BTC`}
                  </span>
                </p>
              </div>
              <div>
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
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Available in your wallet:{" "}
                  <span className="font-mono text-foreground">
                    {walletMusd === null ? "…" : `${num(walletMusd, 2)} MUSD`}
                  </span>
                </p>
              </div>
              <div>
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
                <p className="mt-1 text-[11px] text-muted-foreground">
                  You can take back up to{" "}
                  <span className="font-mono text-foreground">{num(takeMax, 6)} BTC</span>
                </p>
              </div>
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
