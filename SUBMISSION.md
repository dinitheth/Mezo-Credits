# Submission Pack — MezoFlow

## Live proof (Mezo test network 31611)

- Payment contract: `0x99A9554C090C206a3811604448E5a29CAaB00d45` (verified `InvoiceRouter`)
- Deploy receipt: `0x631a15b33f687cbe5120f3841f3e052f3afeaeb4a1eec50bec190fad70df5338` (block 16173807)
- Lending pool: `0x241af24502bD8DC163c1163Cdb35E9845510544f` (`FlowVault`)
- MUSD test network: `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`
- Explorer: `https://explorer.test.mezo.org`

## Where each judging criterion is proven

| Criterion | Proof in this repo |
| --- | --- |
| Mezo integration | Two contracts live on Mezo test network 31611; every payment, loan and deposit is a real wallet transaction with an explorer receipt. MUSD is the money moved; no mocked balances or hashes. See addresses above and `contracts/`. |
| Product and business viability | A payer needs only a wallet on Mezo; a payee makes a link in seconds. First users are freelancers and small shops already paid in MUSD, plus Bitcoin holders who want dollars without selling. See the business note below. |
| Technical implementation | `src/lib/onchain.ts` (typed contract calls, chunked log reads, price freshness), `src/lib/bills.ts` (receipt reconciliation), `contracts/InvoiceRouter.sol`, `contracts/FlowVault.sol`; 34 tests in `tests/`; typecheck and production build pass. Bills are plain records, never chain activity. |
| User experience | Plain-word pages, no protocol jargon; Disconnect; friendly failure text that says nothing moved; mobile layout; QR codes and receipt links. Borrowing pauses with a plain explanation when the pool price is old. |
| Submission materials | This file, `README.md`, `contracts/README.md`, the deploy receipt, and the demo script below. Live URL and video are the last two fields to fill. |

## Who it is for and how it could pay for itself

- **First users:** freelancers and small shops already paid in MUSD, and Bitcoin holders who want spending money without selling their Bitcoin.
- **Why they switch:** a payment link is easier to try than a new account, and the payer only needs a wallet on Mezo.
- **Revenue path (not switched on yet):** keep a small share of the 1% yearly borrower fee, or add a flat fee per paid bill. Lenders keep the rest. No fee is charged today.
- **Risks:** pool liquidity and the owner-posted price. The app shows the price age and pauses new loans after 15 minutes; a later version can move pricing to an oracle. Contracts are small and tested but not audited.
- **Traction:** _add real numbers before submitting (people, bills paid, MUSD lent)._

## Try it yourself

1. `bun install; bun run dev` → open the localhost address from the terminal.
2. Connect wallet → switch to Mezo → check your money shows.
3. Get paid page → make a link → open the pay page → Pay now. The link turns
   Paid and the money appears under Money received, even from another device.
4. Same bill → Approve and pay → see the contract receipt on Mezo.
5. Borrow page → type Bitcoin → pick a safety level → borrow from the pool.
6. Grow page → lend MUSD → see your share and take some back.

## AKINDO answers

- Tracks: 1 (money that works) + 2 (money more people can use)
- Network: Mezo test network (main network contracts are not deployed yet)
- For: Bitcoin holders who want dollar spending money; freelancers and small shops billing in MUSD
- Built with: TanStack Start v1, React 19, Vite 8, Tailwind v4, `viem`, Solidity 0.8.20 (`InvoiceRouter`, `FlowVault`)
- Repo: `https://github.com/dinitheth/Mezo-Credits`
- Live app: _add the published URL before submitting_
- Demo video (2 min): _record before submitting_ — connect → pay now → approve and pay → money received → borrow → grow

## Honest note for judges

Everything this app does is live on the Mezo test network: balances, prices,
bills, payments, receipts, borrowing and lending. Bills are requests, not
tokens; payments are real wallet transactions with public receipts. The pool
price is posted by the pool owner; the app shows how old it is and pauses new
loans until it is refreshed. Main network contracts are not deployed yet.
