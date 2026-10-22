/** One plain sentence for the person using the app — never a raw wallet error. */
export function friendly(e: unknown): string {
  const bag = e as { code?: unknown; message?: unknown; shortMessage?: unknown } | null | undefined;
  const code = typeof bag?.code === "number" ? bag.code : undefined;
  const text =
    e instanceof Error
      ? e.message
      : typeof bag?.shortMessage === "string"
        ? bag.shortMessage
        : typeof bag?.message === "string"
          ? bag.message
          : typeof e === "string"
            ? e
            : "";
  const raw = text.trim();
  const m = raw.toLowerCase();
  if (code === 4001 || /4001|rejected|denied|cancel/.test(m))
    return "You closed the wallet popup, so nothing happened.";
  if (/insufficient funds|insufficient balance|exceeds balance/.test(m))
    return "There is not enough money in your wallet for this. Top up and try again.";
  if (/no chain was provided|chain mismatch|unrecognized chain|wrong network/.test(m))
    return "Your wallet is on the wrong network. Switch to Mezo and try again.";
  if (/execution reverted/.test(m))
    return "The pool said no to this one. Check the amount and try again.";
  if (/timeout|timed out|not confirmed/.test(m))
    return "The network is slow right now. Check Past payments in a minute.";
  if (/network read failed|failed to fetch|fetch failed/.test(m))
    return "We could not reach the network. Check your connection and try again.";
  const clean =
    raw !== "[object Object]" &&
    !/0x[0-9a-fA-F]{16,}|\bviem\b|Request Arguments|Version:|JSON-RPC|\bRPC\b|https?:\/\//.test(
      raw,
    );
  return clean && raw.length > 0 && raw.length <= 160
    ? raw
    : "That did not go through. Nothing moved. Please try again.";
}
