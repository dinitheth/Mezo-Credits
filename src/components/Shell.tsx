import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import {
  MEZO,
  autoRestore,
  connectWallet,
  disconnectWallet,
  hydrateStore,
  short,
  switchToMezo,
  useStore,
} from "@/lib/mezo";
import mezoLogo from "@/assets/mezoflow-logo.png";
import { Btn } from "./ui-bits";
import { DynamicConnectArea } from "./DynamicWallet";
import { friendly } from "@/lib/errors";

const THEME_KEY = "mezoflow-theme";

export function Shell({ children }: { children: ReactNode }) {
  const s = useStore();
  const [err, setErr] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    hydrateStore();
    autoRestore();
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") {
      setTheme(saved);
      document.documentElement.classList.toggle("dark", saved === "dark");
    }
  }, []);
  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };
  const wrong = s.account && s.chainId !== MEZO.chainId;
  const run = (f: () => Promise<void>) =>
    f()
      .then(() => setErr(null))
      .catch((e) => setErr(friendly(e)));
  const nav = "rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground";
  const active = { className: "bg-secondary text-foreground" };
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
          <img
            src={mezoLogo}
            width={32}
            height={32}
            className="h-8 w-8 shrink-0"
            alt="MezoFlow logo"
          />
          Mezo<span className="text-success">Flow</span>
        </Link>
        <nav className="order-last flex w-full gap-1 overflow-x-auto whitespace-nowrap lg:order-none lg:w-auto">
          <Link to="/dashboard" className={nav} activeProps={active}>
            Home
          </Link>
          <Link to="/borrow" className={nav} activeProps={active}>
            Plan
          </Link>
          <Link to="/earn" className={nav} activeProps={active}>
            Grow
          </Link>
          <Link to="/pay" className={nav} activeProps={active}>
            Get paid
          </Link>
          <Link to="/activity" className={nav} activeProps={active}>
            Past payments
          </Link>
          <Link to="/how-it-works" className={nav} activeProps={active}>
            How it works
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <a
            href="https://faucet.test.mezo.org/"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            Faucet
          </a>
          <Btn
            variant="ghost"
            className="border"
            aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
            title={theme === "light" ? "Dark theme" : "Light theme"}
            onClick={toggleTheme}
          >
            {theme === "light" ? (
              <Moon className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Sun className="h-4 w-4" aria-hidden="true" />
            )}
          </Btn>
          {wrong && (
            <Btn
              variant="ghost"
              className="border-destructive text-destructive"
              onClick={() => run(switchToMezo)}
            >
              Switch to Mezo
            </Btn>
          )}
          {s.account ? (
            <span className="flex items-center gap-2">
              <span className="flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-sm">
                <span
                  className={`h-2 w-2 rounded-full ${wrong ? "bg-destructive" : "bg-success"}`}
                />
                {short(s.account)}
              </span>
              <Btn
                variant="ghost"
                className="border"
                title="Disconnect this wallet"
                onClick={disconnectWallet}
              >
                Disconnect
              </Btn>
            </span>
          ) : (
            <DynamicConnectArea
              remembered={s.lastWallet}
              fallback={
                <Btn
                  onClick={() =>
                    run(async () => {
                      await connectWallet();
                      await switchToMezo().catch(() => {});
                    })
                  }
                >
                  {s.lastWallet ? `Reconnect ${short(s.lastWallet)}` : "Connect wallet"}
                </Btn>
              }
            />
          )}
        </div>
      </header>
      {err && (
        <div className="mx-auto max-w-6xl px-4">
          <div
            role="alert"
            className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {err}
          </div>
        </div>
      )}
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-4">{children}</main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        MezoFlow · Get paid in MUSD on Mezo.
      </footer>
    </div>
  );
}
