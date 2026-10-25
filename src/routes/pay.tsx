import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ArrowLeft, Copy, ExternalLink } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Btn, Card, Field, cleanNum, inputCls } from "@/components/ui-bits";
import { InvoiceQR } from "@/components/InvoiceQR";
import { MEZO, getState, num, setState, short, useStore } from "@/lib/mezo";
import { getIncomingMusdTransfers, getInvoicePaidEvents, routerAddressFor } from "@/lib/onchain";
import { applyBillPayments, mergeMoneyIn, type MoneyIn } from "@/lib/bills";

export const Route = createFileRoute("/pay")({
  validateSearch: z.object({
    amount: z.coerce.number().optional(),
    desc: z.string().optional(),
  }),
  head: () => ({
    meta: [
      { title: "Ask for money — MezoFlow" },
      {
        name: "description",
        content: "Make MUSD payment links people can pay in one step.",
      },
      { property: "og:title", content: "Ask for money — MezoFlow" },
      {
        property: "og:description",
        content: "Shareable MUSD payment links on Mezo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pay,
});

function Pay() {
  const s = useStore();
  const search = Route.useSearch();
  const startAmount = search.amount && search.amount > 0 ? String(search.amount) : "250";
  const startDesc = search.desc || "Design work — October";
  const [amount, setAmount] = useState(startAmount);
  const [desc, setDesc] = useState(startDesc);
  const [to, setTo] = useState("");
  const [copied, setCopied] = useState("");
  const [shareId, setShareId] = useState<string | null>(null);
  const [shareCopyError, setShareCopyError] = useState(false);
  const [received, setReceived] = useState<MoneyIn[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkErr, setCheckErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const valid = Number(amount) > 0 && /^0x[0-9a-fA-F]{40}$/.test(to || s.account || "");
  const chainId = s.chainId;
  const onMezo = chainId === null || chainId === 31611 || chainId === 31612;

  useEffect(() => {
    const timer = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let live = true;
    const check = async () => {
      if (!s.account || !chainId || !onMezo) {
        setReceived(null);
        return;
      }
      setChecking(true);
      try {
        const router = routerAddressFor(chainId);
        const [billEvents, transfers] = await Promise.all([
          router ? getInvoicePaidEvents(chainId) : Promise.resolve([]),
          getIncomingMusdTransfers(chainId, s.account).catch(() => []),
        ]);
        if (!live) return;
        const applied = applyBillPayments(getState().invoices, billEvents);
        if (applied.changed) setState({ invoices: applied.invoices });
        const mine = billEvents.filter((e) => e.to.toLowerCase() === s.account!.toLowerCase());
        setReceived(mergeMoneyIn(mine, transfers));
        setCheckErr(null);
      } catch {
        if (live) {
          setReceived(null);
          setCheckErr("Could not check for money received just now. Try again in a minute.");
        }
      } finally {
        if (live) setChecking(false);
      }
    };
    void check();
    return () => {
      live = false;
    };
  }, [s.account, chainId, onMezo, tick, s.invoices.length]);

  const remove = (id: string) => {
    setState({ invoices: getState().invoices.filter((i) => i.id !== id) });
  };
  const create = () => {
    const id = Math.random().toString(36).slice(2, 10);
    const recipient = to || s.account!;
    setState({
      invoices: [
        { id, amount: Number(amount), description: desc.slice(0, 140), recipient },
        ...getState().invoices,
      ],
    });
  };
  const link = (i: { id: string; amount: number; description: string; recipient: string }) =>
    `${typeof window === "undefined" ? "" : window.location.origin}/checkout?id=${i.id}&amount=${i.amount}&to=${i.recipient}&desc=${encodeURIComponent(i.description)}`;
  const sharing = s.invoices.find((i) => i.id === shareId) ?? null;
  const copyShareLink = async () => {
    if (!sharing) return;
    try {
      await navigator.clipboard.writeText(link(sharing));
      setCopied(sharing.id);
      setShareCopyError(false);
    } catch {
      setShareCopyError(true);
    }
  };

  return (
    <Shell showNavigation={!sharing}>
      {sharing ? (
        <div className="mx-auto max-w-3xl space-y-5">
          <button
            type="button"
            onClick={() => {
              setShareId(null);
              setShareCopyError(false);
            }}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to your links
          </button>
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              MezoFlow · Payment request
            </p>
            <h1 className="mt-2 text-3xl font-bold">Share this bill</h1>
            <p className="mt-2 text-muted-foreground">
              Copy the link or let someone scan the code to open your payment page.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-[1fr_1.2fr]">
            <Card className="flex flex-col items-center justify-center text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Amount</p>
              <p className="mt-1 font-mono text-3xl text-success">
                {num(sharing.amount, 2)} <span className="text-base">MUSD</span>
              </p>
              <p className="mt-3 font-medium">{sharing.description}</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                to {short(sharing.recipient)}
              </p>
              <div className="mt-5">
                <InvoiceQR
                  url={link(sharing)}
                  amount={sharing.amount}
                  description={sharing.description}
                  showShareAction={false}
                />
              </div>
            </Card>
            <Card className="flex flex-col justify-center space-y-4">
              <div>
                <h2 className="font-semibold">Your payment link</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Send this link to the person who needs to pay.
                </p>
              </div>
              <div className="break-all rounded-lg border bg-muted/40 p-3 font-mono text-xs text-muted-foreground">
                {link(sharing)}
              </div>
              <Btn className="w-full" onClick={() => void copyShareLink()}>
                <Copy className="h-4 w-4" aria-hidden="true" />
                {copied === sharing.id ? "Link copied" : "Copy payment link"}
              </Btn>
              {shareCopyError && (
                <p role="alert" className="text-sm text-destructive">
                  Could not copy the link. Select and copy it above.
                </p>
              )}
              <Link
                to="/checkout"
                search={{
                  id: sharing.id,
                  amount: sharing.amount,
                  to: sharing.recipient,
                  desc: sharing.description,
                }}
                className="inline-flex items-center justify-center gap-2 rounded-lg border bg-secondary px-4 py-2.5 text-sm font-semibold text-secondary-foreground hover:bg-muted"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Open payment page
              </Link>
            </Card>
          </div>
        </div>
      ) : (
        <>
          <h1 className="text-3xl font-bold">Ask for money</h1>
          <p className="mt-2 text-muted-foreground">
            Make a payment link. Share it, and the money lands straight in your wallet.
          </p>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card className="space-y-4">
              <Field label="Amount in dollars (MUSD)">
                <input
                  className={inputCls}
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(cleanNum(e.target.value, 2))}
                />
              </Field>
              <Field label="What is it for?">
                <input
                  className={inputCls + " font-sans"}
                  maxLength={140}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                />
              </Field>
              <Field
                label="Send the money to"
                tip="The wallet that gets paid. Empty means your own wallet."
              >
                <input
                  className={inputCls}
                  placeholder={s.account ?? "0x…"}
                  value={to}
                  onChange={(e) => setTo(e.target.value.trim())}
                />
              </Field>
              {!valid && (
                <p className="text-xs text-muted-foreground">
                  Add an amount. To send to someone else, paste their wallet address.
                </p>
              )}
              <Btn className="w-full" disabled={!valid} onClick={create}>
                Make the link
              </Btn>
            </Card>
            <div className="space-y-3">
              <h2 className="font-semibold">Your links</h2>
              {s.invoices.length === 0 && (
                <Card className="text-sm text-muted-foreground">
                  Nothing here yet. Make your first link on the left.
                </Card>
              )}
              {s.invoices.map((i) => (
                <Card key={i.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-lg text-success">{num(i.amount, 2)} MUSD</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${i.paid ? "bg-success/20 text-success" : "bg-primary/15 text-primary"}`}
                    >
                      {i.paid ? "Paid" : "Open"}
                    </span>
                  </div>
                  <p className="text-sm">{i.description}</p>
                  <p className="font-mono text-xs text-muted-foreground">to {short(i.recipient)}</p>
                  {!i.paid && (
                    <InvoiceQR
                      url={link(i)}
                      amount={i.amount}
                      description={i.description}
                      compact
                      onShare={() => {
                        setShareId(i.id);
                        setShareCopyError(false);
                      }}
                    />
                  )}
                  <div className="flex gap-2">
                    <Btn
                      variant="ghost"
                      className="py-1.5"
                      onClick={() => {
                        navigator.clipboard.writeText(link(i));
                        setCopied(i.id);
                      }}
                    >
                      {copied === i.id ? "Copied!" : "Copy link"}
                    </Btn>
                    <Link
                      to="/checkout"
                      search={{ id: i.id, amount: i.amount, to: i.recipient, desc: i.description }}
                    >
                      <Btn variant="ghost" className="py-1.5">
                        Open pay page
                      </Btn>
                    </Link>
                    <Btn variant="ghost" className="py-1.5" onClick={() => remove(i.id)}>
                      Remove
                    </Btn>
                  </div>
                </Card>
              ))}
              <div className="pt-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 className="font-semibold">Money received</h2>
                  <button
                    type="button"
                    onClick={() => setTick((n) => n + 1)}
                    disabled={checking || !s.account}
                    className="text-xs text-primary underline disabled:opacity-40"
                  >
                    {checking ? "Checking…" : "Refresh"}
                  </button>
                </div>
                {!s.account ? (
                  <Card className="text-sm text-muted-foreground">
                    Connect your wallet to see money coming in.
                  </Card>
                ) : !onMezo ? (
                  <Card className="text-sm text-muted-foreground">
                    Switch to Mezo to see money coming in.
                  </Card>
                ) : received === null ? (
                  <Card className="text-sm text-muted-foreground">
                    {checking
                      ? "Checking the payment contract…"
                      : checkErr
                        ? "Could not check just now."
                        : "Nothing here yet."}
                  </Card>
                ) : received.length === 0 ? (
                  <Card className="text-sm text-muted-foreground">
                    Nothing yet. When someone pays one of your links it shows here, even if they
                    paid from another device.
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {received.slice(0, 10).map((m) => (
                      <Card key={m.key} className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-lg text-success">
                            {num(m.amount, 2)} MUSD
                          </span>
                          <a
                            className="text-xs text-primary underline"
                            href={`${MEZO.explorer}/tx/${m.tx}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            receipt
                          </a>
                        </div>
                        <p className="text-sm">{m.desc}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          from {short(m.from)} ·{" "}
                          {m.source === "bill" ? "bill paid" : "sent directly"}
                        </p>
                      </Card>
                    ))}
                  </div>
                )}
                {checkErr && (
                  <p role="alert" className="mt-2 text-xs text-destructive">
                    {checkErr}
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}
