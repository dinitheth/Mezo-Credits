import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/Shell";
import { OnchainPanel } from "@/components/OnchainPanel";
import { Btn, Card, Field, Stat, cleanNum, inputCls } from "@/components/ui-bits";
import { logActivity, num, setActivityStatus, useStore } from "@/lib/mezo";
import { friendly } from "@/lib/errors";
import {
  approveRouter,
  didSucceed,
  getMusdBalance,
  getVaultGlobals,
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
      {
        name: "description",
        content: "Lend MUSD to borrowers. The yearly fee is added when loans are repaid.",
      },
      { property: "og:title", content: "Grow your money — MezoFlow" },
      {
        property: "og:description",
        content: "Lend MUSD. Fees reach the pool when borrowers repay.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Earn,
});

function Earn() {
  const s = useStore();
  const vault = vaultAddressFor(s.chainId ?? 31611);
  const onMezo = !s.chainId || s.chainId === 31611 || s.chainId === 31612;
  const [poolValue, setPoolValue] = useState(0);
  const [shares, setShares] = useState(0n);
  const [poolSize, setPoolSize] = useState(0);
  const [walletMusd, setWalletMusd] = useState<number | null>(null);
  const [dep, setDep] = useState("");
  const [wd, setWd] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = async () => {
    if (!vault) return;
    try {
      const g = await getVaultGlobals(vault);
      setPoolSize(Number(g.poolBalance) / 1e18);
      if (!s.account) {
        setWalletMusd(null);
        return;
      }
      const musd = musdAddressFor(s.chainId);
      if (musd) {
        const held = await getMusdBalance(s.account, musd).catch(() => null);
        setWalletMusd(held);
      }
      const pos = await getVaultPosition(vault, s.account);
      setPoolValue(Number(pos.poolValue) / 1e18);
      setShares(pos.shares);
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
      const approval = await approveRouter(musd, vault, dep, account);
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
      setErr(friendly(e));
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
      setErr(friendly(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <h1 className="text-3xl font-bold">Grow your money</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Lend MUSD to borrowers. They owe 1% a year, and that fee reaches the pool when they repay.
        Money out on loan is not cash you can take until it comes back.
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
            <div className="grid grid-cols-2 gap-5">
              <Stat
                label="Cash in the pool"
                value={`${num(poolSize, 2)} MUSD`}
                tone="green"
                tip="MUSD sitting in the pool right now. Money out on loan is not included."
              />
              <Stat
                label="Your share in cash"
                value={`${num(poolValue, 2)} MUSD`}
                tone="gold"
                tip="Cash your shares can take now. Money out on loan, and fees not yet repaid, are not included."
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              These numbers are cash only. Loans out, and fees not yet paid, are not in them.
            </p>
            {!onMezo && (
              <p className="mt-3 text-xs text-muted-foreground">
                You are on another network. Switch to Mezo to lend or take back.
              </p>
            )}
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
              <p className="text-xs text-muted-foreground">
                In your wallet:{" "}
                <span className="font-mono text-foreground">
                  {!s.account ? "—" : walletMusd === null ? "…" : `${num(walletMusd, 2)} MUSD`}
                </span>
              </p>
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
              <p className="text-xs text-muted-foreground">
                Cash you can take now:{" "}
                <span className="font-mono text-foreground">{num(poolValue, 2)} MUSD</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Money out on loan becomes available when borrowers repay.
              </p>
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
          <h3 className="font-semibold text-primary">When growth happens</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Borrowers owe 1% a year. The fee is added to the pool only when they repay, and then
            every share is worth more. If nothing is repaid, the pool has not grown.
          </p>
        </Card>
        <Card>
          <h3 className="font-semibold text-primary">MEZO coin</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            MEZO is Mezo&apos;s own coin for lower fees and votes. It is not needed to lend or
            borrow here.
          </p>
        </Card>
      </div>
    </Shell>
  );
}
