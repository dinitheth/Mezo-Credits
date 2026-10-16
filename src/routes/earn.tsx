import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/Shell";
import { OnchainPanel } from "@/components/OnchainPanel";
import { Btn, Card, Field, Stat, cleanNum, inputCls } from "@/components/ui-bits";
import { logActivity, num, setActivityStatus, useStore } from "@/lib/mezo";
import {
  approveRouter,
  didSucceed,
  getMusdBalance,
  getVaultPosition,
  musdAddressFor,
  vaultAddressFor,
  vaultLend,
  vaultUnlend,
  waitForReceipt,
} from "@/lib/onchain";

export const Route = createFileRoute("/earn")({
  head: () => ({
    meta: [
      { title: "Grow your money — MezoFlow" },
      { name: "description", content: "Lend MUSD to borrowers and earn the fees." },
      { property: "og:title", content: "Grow your money — MezoFlow" },
      { property: "og:description", content: "Fund the pool, earn borrower fees." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Earn,
});

function Earn() {
  const s = useStore();
  const vault = vaultAddressFor(s.chainId);
  const [poolValue, setPoolValue] = useState(0);
  const [shares, setShares] = useState(0n);
  const [poolSize, setPoolSize] = useState(0);
  const [dep, setDep] = useState("");
  const [wd, setWd] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = async () => {
    if (!vault || !s.account) return;
    try {
      const pos = await getVaultPosition(vault, s.account);
      setPoolValue(Number(pos.poolValue) / 1e18);
      setShares(pos.shares);
      setPoolSize(Number(pos.poolBalance) / 1e18);
    } catch {
      // Leave last values on screen.
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vault, s.account]);

  const need = () => {
    if (!s.account) throw new Error("Connect your wallet first.");
    if (!vault) throw new Error("The pool is not open yet.");
    const musd = musdAddressFor(s.chainId);
    if (!musd) throw new Error("Switch to the Mezo network in your wallet first.");
    return { account: s.account, musd };
  };

  const deposit = async () => {
    const a = Number(dep) || 0;
    if (!a) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const { account, musd } = need();
      if (!vault) throw new Error("The pool is not open yet.");
      const held = await getMusdBalance(account, musd).catch(() => 0);
      if (held < a)
        throw new Error(
          `You hold ${held} MUSD — less than this. Get test MUSD first (borrow on Mezo's test site), then lend it here.`,
        );
      setMsg("Step 1 of 2: approving in your wallet…");
      const approval = await approveRouter(musd, vault, dep, account).catch((e) => {
        if (!/rejected|denied/i.test(e instanceof Error ? e.message : String(e))) throw e;
        throw new Error("You said no in your wallet. Nothing moved.");
      });
      setMsg("Waiting on step 1…");
      await waitForReceipt(approval);
      setMsg("Step 2 of 2: putting it in…");
      const hash = await vaultLend(vault, account, dep);
      logActivity("pool_deposit", a, "MUSD", "Lent to borrowers", hash);
      setDep("");
      await refresh();
      setMsg(`Lent ${num(a, 2)} MUSD · receipt ${hash.slice(0, 12)}…`);
      void didSucceed(hash).then((ok) => {
        if (ok === false) {
          setActivityStatus(hash, "failed");
          setMsg("That did not go through (see Past payments). Nothing moved.");
        }
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "That did not go through. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    const a = Number(wd) || 0;
    if (!a || shares === 0n) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      if (!vault) throw new Error("The pool is not open yet.");
      if (!s.account) throw new Error("Connect your wallet first.");
      const pos = await getVaultPosition(vault, s.account);
      const n =
        pos.totalShares === 0n
          ? 0n
          : (BigInt(Math.round(a * 1e18)) * pos.totalShares) /
            (pos.poolBalance === 0n ? 1n : pos.poolBalance);
      const take = n > pos.shares ? pos.shares : n;
      if (take === 0n) throw new Error("Nothing to take.");
      const hash = await vaultUnlend(vault, s.account, take);
      logActivity("pool_withdraw", a, "MUSD", "Took back from the pool", hash);
      setWd("");
      await refresh();
      setMsg(`Took ${num(a, 2)} MUSD · receipt ${hash.slice(0, 12)}…`);
      void didSucceed(hash).then((ok) => {
        if (ok === false) {
          setActivityStatus(hash, "failed");
          setMsg("That did not go through (see Past payments). Nothing moved.");
        }
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "That did not go through. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <h1 className="text-3xl font-bold">Grow your money</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Lend MUSD to the pool. Borrowers pay fees, and the fees grow what your share is worth. Take
        out any time there is money in the pool.
      </p>

      {!vault ? (
        <Card className="mt-6">
          <h2 className="text-xl font-semibold">The pool opens at launch</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Lending starts as soon as our pool contract is live on Mezo.
          </p>
          <div className="mt-3">
            <Link to="/borrow">
              <Btn variant="ghost">Plan a loan meanwhile</Btn>
            </Link>
          </div>
        </Card>
      ) : (
        <>
          <Card className="mt-6">
            <div className="grid grid-cols-2 gap-5 md:grid-cols-3">
              <Stat label="Money in the pool" value={`${num(poolSize, 2)} MUSD`} tone="green" />
              <Stat label="Your share is worth" value={`${num(poolValue, 2)} MUSD`} tone="gold" />
              <Stat label="MEZO" value="Shown under your money" />
            </div>
          </Card>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card className="space-y-3">
              <h2 className="font-semibold">Lend MUSD</h2>
              <Field label="How much">
                <div className="flex gap-2">
                  <input
                    className={inputCls}
                    inputMode="decimal"
                    value={dep}
                    onChange={(e) => setDep(cleanNum(e.target.value, 2))}
                    placeholder="0.00"
                  />
                  <Btn variant="green" onClick={() => void deposit()} disabled={busy || !dep}>
                    Lend
                  </Btn>
                </div>
              </Field>
            </Card>
            <Card className="space-y-3">
              <h2 className="font-semibold">Take back</h2>
              <Field label="How much">
                <div className="flex gap-2">
                  <input
                    className={inputCls}
                    inputMode="decimal"
                    value={wd}
                    onChange={(e) => setWd(cleanNum(e.target.value, 2))}
                    placeholder="0.00"
                  />
                  <Btn variant="ghost" onClick={() => void withdraw()} disabled={busy || !wd}>
                    Take
                  </Btn>
                </div>
              </Field>
            </Card>
          </div>
          {msg && (
            <p className="mt-3 text-sm text-success" aria-live="polite">
              {msg}
            </p>
          )}
          {err && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {err}
            </p>
          )}
        </>
      )}

      <div className="mt-4">
        <OnchainPanel />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="font-semibold text-primary">Where growth comes from</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Every loan pays a small yearly fee. Fees stay in the pool, so each share becomes worth a
            little more over time.
          </p>
        </Card>
        <Card>
          <h3 className="font-semibold text-primary">MEZO coin</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            MEZO is Mezo&apos;s own coin for lower fees and votes. Your balance shows under your
            money when it&apos;s on your network.
          </p>
        </Card>
      </div>
    </Shell>
  );
}
