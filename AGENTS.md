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
- Document simulated financial operations explicitly in README.md because wallet connectivity alone does not provide on-chain credit or payments.
- Every simulated state change goes through logActivity() in src/lib/mezo.ts so the /activity ledger stays complete.
