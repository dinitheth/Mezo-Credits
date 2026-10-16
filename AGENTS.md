<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- Keep MezoFlow's app logo separate from the official Bitcoin asset, and derive the public favicon from the app logo so branding stays consistent.
- Treat network display copy separately from wallet chain constants; presentation changes must not switch RPC endpoints or imply production settlement.
- The app records only real wallet payments in `src/lib/mezo.ts` (`logActivity()` needs a real receipt hash). Never invent transaction hashes or balances. Payment requests (bills) are plain records, not chain activity.
- Keep words plain and short on every screen: no protocol or wallet jargon in the UI. Bills, money, pay, receipt — not invoices-as-tokens, EIP-712, eth_call, or Troves.
