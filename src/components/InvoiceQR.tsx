import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Download, Share2 } from "lucide-react";
import { Btn } from "./ui-bits";
import { num, sats, useStore } from "@/lib/mezo";

/** Scannable invoice QR with MUSD / BTC breakdown, download and share. */
export function InvoiceQR({
  url,
  amount,
  description,
  compact,
  onShare,
  showShareAction = true,
}: {
  url: string;
  amount: number;
  description: string;
  compact?: boolean;
  onShare?: (() => void) | undefined;
  showShareAction?: boolean;
}) {
  const s = useStore();
  const wrap = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState("");
  const price = s.priceLive && s.btcPrice > 0 ? s.btcPrice : 0;
  const btc = price > 0 ? amount / price : 0;

  const download = () => {
    const c = wrap.current?.querySelector("canvas");
    if (!c) return;
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `mezoflow-invoice-${num(amount, 2).replace(/,/g, "")}-musd.png`;
    a.click();
  };
  const share = async () => {
    if (onShare) {
      onShare();
      return;
    }
    try {
      if (navigator.share)
        await navigator.share({
          title: "MezoFlow invoice",
          text: `${num(amount, 2)} MUSD — ${description}`,
          url,
        });
      else {
        await navigator.clipboard.writeText(url);
        setNote("Link copied");
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div
      className={
        compact
          ? "flex flex-col items-center gap-3 sm:flex-row sm:items-start"
          : "flex flex-col items-center gap-3"
      }
    >
      <div ref={wrap} className="rounded-xl bg-card p-3 ring-1 ring-border">
        <div className="rounded-md bg-[oklch(1_0_0)] p-2">
          <QRCodeCanvas
            value={url}
            size={compact ? 128 : 176}
            marginSize={1}
            level="M"
            aria-label="Payment code"
            role="img"
          />
        </div>
      </div>
      <div className="flex-1 space-y-2 text-center sm:text-left">
        <div className="font-mono text-sm">
          <span className="text-success">{num(amount, 2)} MUSD</span>{" "}
          {price > 0 && (
            <>
              <span className="text-muted-foreground">≈</span>{" "}
              <span className="text-primary">{num(btc, 8)} BTC</span>
            </>
          )}
        </div>
        {price > 0 && (
          <div className="font-mono text-xs text-muted-foreground">
            {sats(btc)} sats at Bitcoin {num(price, 0)} dollars
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
          <Btn variant="ghost" className="py-1.5" onClick={download}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Save code
          </Btn>
          {showShareAction && (
            <Btn variant="ghost" className="py-1.5" onClick={() => void share()}>
              <Share2 className="h-4 w-4" aria-hidden="true" />
              Share
            </Btn>
          )}
        </div>
        {note && (
          <p className="text-xs text-success" aria-live="polite">
            {note}
          </p>
        )}
      </div>
    </div>
  );
}
