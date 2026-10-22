import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/Shell";
import { BtcWord } from "@/components/BitcoinMark";
import { CreditForm } from "@/components/CreditForm";
import { OnchainPanel } from "@/components/OnchainPanel";
import { Btn, Card } from "@/components/ui-bits";
import { logActivity, num, setActivityStatus, useStore } from "@/lib/mezo";
import { friendly } from "@/lib/errors";
import {
  didSucceed,
  getMusdBalance,
  getVaultGlobals,
  getVaultPosition,
  musdAddressFor,
  parseMUSD,
  priceAgeLabel,
  priceIsStale,
  vaultAddressFor,
  vaultOpenLoan,
  vaultSetPrice,
  waitForReceipt,
} from "@/lib/onchain";

export const Route = createFileRoute("/borrow")({
  head: () => ({
    meta: [
      { title: "Borrow — MezoFlow" },
      {
        name: "description",
        content: "Lock Bitcoin and borrow MUSD from the shared pool.",
      },
      { property: "og:title", content: "Borrow — MezoFlow" },
      {
        property: "og:description",
        content: "Bitcoin-backed borrowing on Mezo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Borrow,
});

function Borrow() {
  const s = useStore();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const vault = vaultAddressFor(s.chainId ?? 31611);
  const onMezo = !s.chainId || s.chainId === 31611 || s.chainId === 31612;
  const [poolSize, setPoolSize] = useState<number | null>(null);
  const [walletMusd, setWalletMusd] = useState<number | null>(null);
  const [poolPrice, setPoolPrice] = useState<bigint>(0n);
  const [priceTime, setPriceTime] = useState<bigint>(0n);
  const [vaultOwner, setVaultOwner] = useState<string | null>(null);
  const [priceBusy, setPriceBusy] = useState(false);
  const [, setTick] = useState(0);
  const autoPrice = useRef<string | null>(null);

  const refreshPool = useCallback(async () => {
    if (!vault) return;
    try {
      const g = await getVaultGlobals(vault);
      setPoolSize(Number(g.poolBalance) / 1e18);
      setPoolPrice(g.price);
      setPriceTime(g.priceTime);
      setVaultOwner(g.owner);
    } catch {
      // Leave the last numbers on screen.
    }
  }, [vault]);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let live = true;
    if (!vault) return;
    getVaultGlobals(vault)
      .then((g) => {
        if (!live) return;
        setPoolSize(Number(g.poolBalance) / 1e18);
        setPoolPrice(g.price);
        setPriceTime(g.priceTime);
        setVaultOwner(g.owner);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [vault]);

  useEffect(() => {
    let live = true;
    const musd = musdAddressFor(s.chainId ?? 31611);
    if (!s.account || !musd) {
      setWalletMusd(null);
      return;
    }
    getMusdBalance(s.account, musd)
      .then((b) => {
        if (live) setWalletMusd(b);
      })
      .catch(() => {
        if (live) setWalletMusd(null);
      });
    return () => {
      live = false;
    };
  }, [s.account, s.chainId]);

  const borrow = async (info: { btc: number; amount: number; tier: number }) => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      if (!s.account) throw new Error("Connect your wallet first.");
      if (!vault) throw new Error("The pool is not open yet. It opens right after launch.");
      if (s.chainId !== 31611 && s.chainId !== 31612)
        throw new Error("Switch to the Mezo network in your wallet first.");
      if (!s.priceLive || s.btcPrice <= 0) throw new Error("Waiting on the live price. Try again.");
      let pos = await getVaultPosition(vault, s.account);
      const want = parseMUSD(info.amount.toFixed(2));
      if (want > pos.poolBalance)
        throw new Error(
          pos.poolBalance === 0n
            ? "The pool is empty, so there is nothing to borrow yet. Seed it once: borrow test MUSD on Mezo's test site, put it in on the Grow page, then borrow here."
            : `The pool holds ${Number(pos.poolBalance) / 1e18} MUSD — less than this loan. Try a smaller amount.`,
        );
      if (pos.price === 0n || priceIsStale(pos.priceTime)) {
        if (pos.owner.toLowerCase() !== s.account.toLowerCase()) {
          const age = pos.price === 0n ? "not set" : `${priceAgeLabel(pos.priceTime)} old`;
          throw new Error(
            `The pool price is ${age}, so new loans wait for a refresh. The pool owner can update it.`,
          );
        }
        const fix = await vaultSetPrice(vault, s.account, s.btcPrice);
        await waitForReceipt(fix);
        pos = await getVaultPosition(vault, s.account);
        if (pos.price === 0n || priceIsStale(pos.priceTime))
          throw new Error("The pool price did not update. Try again in a minute.");
        void refreshPool();
      }
      const hash = await vaultOpenLoan(
        vault,
        s.account,
        info.amount.toFixed(2),
        info.tier,
        info.btc,
      );
      logActivity("borrow", info.amount, "MUSD", `Locked ${info.btc} BTC at ${info.tier}%`, hash);
      setMsg(`Borrowed ${num(info.amount, 2)} MUSD · receipt ${hash.slice(0, 12)}…`);
      void refreshPool();
      void didSucceed(hash).then((ok) => {
        if (ok === false) {
          setActivityStatus(hash, "failed");
          setMsg("That did not go through (see Past payments). Nothing moved.");
        } else if (ok) {
          const musd = musdAddressFor(s.chainId ?? 31611);
          if (s.account && musd)
            void getMusdBalance(s.account, musd)
              .then(setWalletMusd)
              .catch(() => {});
        }
      });
    } catch (e) {
      setErr(friendly(e));
    } finally {
      setBusy(false);
    }
  };

  const isOwner = Boolean(
    s.account && vaultOwner && s.account.toLowerCase() === vaultOwner.toLowerCase(),
  );
  const stale = poolSize !== null && (poolPrice === 0n || priceIsStale(priceTime));

  useEffect(() => {
    const account = s.account;
    if (!vault || !account || !isOwner || !stale || !onMezo) return;
    if (!s.priceLive || s.btcPrice <= 0) return;
    const key = `${vault}:${priceTime.toString()}`;
    if (autoPrice.current === key) return;
    autoPrice.current = key;
    setPriceBusy(true);
    void (async () => {
      try {
        const hash = await vaultSetPrice(vault, account, s.btcPrice);
        await waitForReceipt(hash);
        await refreshPool();
      } catch {
        // The wallet may have closed the popup. Borrowing asks again.
      } finally {
        setPriceBusy(false);
      }
    })();
  }, [vault, s.account, isOwner, stale, onMezo, s.priceLive, s.btcPrice, priceTime, refreshPool]);

  return (
    <Shell>
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <h1 className="text-3xl font-bold">Borrow</h1>
          <p className="mt-2 text-muted-foreground">
            Lock Bitcoin here and borrow MUSD, Mezo&apos;s
            <BtcWord text="Bitcoin-backed" /> dollar. Lenders fund the pool and earn the fees.
          </p>
          <ol className="mt-6 space-y-3 text-sm text-muted-foreground">
            <li>
              <b className="text-foreground">1. Type your Bitcoin.</b> The live price fills in by
              itself.
            </li>
            <li>
              <b className="text-foreground">2. Pick a safety level.</b> Higher means less to
              borrow, more room if prices fall.
            </li>
            <li>
              <b className="text-foreground">3. Borrow.</b> Your Bitcoin locks in our pool contract
              and MUSD lands in your wallet.
            </li>
          </ol>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/dashboard">
              <Btn variant="ghost">See your loan</Btn>
            </Link>
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
        </div>
        <Card className="lg:col-span-3">
          {!vault ? (
            <div className="space-y-3 text-center">
              <h2 className="text-xl font-semibold">The pool is not open on this network</h2>
              <p className="text-sm text-muted-foreground">
                Switch to Mezo to borrow from the pool. The planner below still runs on live prices.
              </p>
            </div>
          ) : (
            priceBusy && (
              <p className="mb-2 text-center text-xs text-muted-foreground" aria-live="polite">
                Updating the pool price…
              </p>
            )
          )}
          <CreditForm
            onBorrow={vault && onMezo ? borrow : undefined}
            borrowing={busy}
            walletMusd={walletMusd}
            poolSize={poolSize}
          />
        </Card>
      </div>
      <div className="mt-4">
        <OnchainPanel />
      </div>
    </Shell>
  );
}
