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
| Technical implementation | `src/lib/onchain.ts` (typed contract calls, chunked log reads, price freshness), `src/lib/bills.ts` (receipt reconciliation), `contracts/InvoiceRouter.sol`, `contracts/FlowVault.sol`; 100 tests in `tests/`; typecheck and production build pass. Bills are plain records, never chain activity. |
| User experience | Plain-word pages, no protocol jargon; Disconnect; friendly failure text that says nothing moved; mobile layout; QR codes and receipt links. The pool price refreshes itself for the owner, and borrowing pauses rather than pricing off an old number. |
| Submission materials | This file, `README.md`, `contracts/README.md`, the deploy receipt, and the demo script below. Live URL and video are the last two fields to fill. |

## Who it is for and how it could pay for itself

- **First users:** freelancers and small shops already paid in MUSD, and Bitcoin holders who want spending money without selling their Bitcoin.
- **Why they switch:** a payment link is easier to try than a new account, and the payer only needs a wallet on Mezo.
- **Revenue path (not switched on yet):** keep a small share of the 1% yearly borrower fee, or add a flat fee per paid bill. Lenders keep the rest. No fee is charged today.
- **Risks:** pool liquidity and the owner-posted price. The owner's app refreshes it automatically and new loans pause after 15 minutes; a later version can move pricing to an oracle. Contracts are small and tested but not audited.
- **Traction:** _add real numbers before submitting (people, bills paid, MUSD lent)._

## Try it yourself

1. `bun install; bun run dev` → open the localhost address from the terminal.
2. Connect wallet → switch to Mezo → check your money shows.
3. Get paid page → make a link → open the pay page → choose "Approve and pay".
   The bill turns Paid and the money appears under Money received, even from
   another device.
4. Same bill → "Send directly" sends MUSD straight to the wallet. It appears
   under Money received with its wallet receipt, but the bill stays unpaid
   because only the contract route writes a receipt.
5. Borrow page → type Bitcoin → pick a safety level → borrow from the pool.
6. Grow page → lend MUSD → see your share and take some back.

## AKINDO form answers

- **Project name:** MezoFlow
- **Category:** Payments and borrowing
- **TL;DR:** MezoFlow turns MUSD into spendable money: payment links with real receipts, plus a pool where Bitcoin holders borrow MUSD and savers lend it.
- **How it works:** Freelancers and shops get paid in dollars but hold Bitcoin. A payee makes a bill in seconds and shares a link or QR code; the payer connects a Mezo wallet and chooses: pay straight to the wallet, or pay through `InvoiceRouter` for a public receipt. Bills are plain records, so the payee's page marks them paid on any device by reading the contract's `InvoicePaid` events; a direct payment still lands under Money received with its wallet receipt. On the credit side, Bitcoin holders lock BTC in `FlowVault` and borrow MUSD at 150/200/250% safety; lenders deposit MUSD, and the 1% yearly fee is added to the pool when loans are repaid (none collected on testnet yet). MUSD is the unit of account for every bill, the asset borrowers receive, and the asset lenders earn. MEZO is not needed for the core flow; it is the network's fee and governance coin.
- **Target group:** Freelancers, small shops and Bitcoin holders. No DeFi knowledge assumed: the payer only needs a wallet on Mezo, and every screen uses plain words. Mobile-first for paying and sharing; desktop for managing a loan or a pool position. Global, English. Fits Track 1 because money actually moves, and Track 2 because links and plain words lower the entry bar.
- **Tech stack:** TanStack Start v1, React 19, Vite 8, Tailwind v4, TypeScript, RainbowKit, wagmi, `viem`, Solidity 0.8.20, Mezo testnet RPC, Vitest (100 tests).
- **Track:** Both.
- **Chain deployed on:** Mezo test network (chain 31611). Main network contracts are not deployed.
- **Project status:** _entirely new, or existing with features added during the hackathon — pick one and link the previous site if any._
- **Project readiness:** Testnet deployment.
- **Future milestones:**
  1. 4–6 weeks: deploy `InvoiceRouter` and `FlowVault` to Mezo mainnet, and move pricing to an oracle with the same 15-minute guard.
  2. 6–10 weeks: indexer plus notifications (email/Telegram) for bills, installable PWA for shops, batch payout view.
  3. 3 months: pilot with 5–10 merchants, independent contract review, switch on a small fee.
- **Team:** _add names, roles, X or LinkedIn._
- **Repo:** `https://github.com/dinitheth/Mezo-Credits`
- **Live app:** _add the published URL before submitting._
- **Deck:** _link the product deck before submitting._
- **Pitch video (2 min):** _link the video before submitting._

### If this is a Wave 2 resubmission

Since Wave 1 this repo added: the real `FlowVault` borrowing/lending pool,
`InvoicePaid`-based bill reconciliation, a Money received list, the 15-minute
pool price freshness guard with owner refresh, Disconnect, plain-word failure
text, and tests moved to `tests/` (100 passing).

## Deck outline (8 slides)

1. **Title** — MezoFlow · MUSD payments and borrowing · testnet live · repo link.
2. **Problem** — freelancers and shops bill in dollars; Bitcoin holders do not want to sell; wallets can send but do not reconcile bills.
3. **Solution** — payment link or QR → pay in MUSD → public receipt; borrow against Bitcoin; lend MUSD for fees when loans repay.
4. **Demo** — four screenshots: a bill, checkout, Money received, Borrow.
5. **Mezo fit** — MUSD as unit of account, credit asset and lender fee income; two live contracts on 31611.
6. **How it works** — small diagram: browser → wallet → Mezo RPC → `InvoiceRouter` / `FlowVault`; event scan reconciles bills.
7. **Users and business** — first users, wedge, revenue path, honest risks.
8. **Roadmap and team** — three milestones with dates, team, live URL.

## Two-minute video shot list

- 0:00–0:15 — "Bitcoin holders need dollars without selling. Shops need to get paid in dollars."
- 0:15–0:40 — Get paid: type 25 MUSD, make the link, show the QR code.
- 0:40–1:05 — Pay page: choose "Approve and pay"; show the bill turn Paid with its receipt.
- 1:05–1:20 — Money received: show the payment and open the explorer receipt.
- 1:20–1:45 — Borrow: lock Bitcoin, borrow MUSD, show the receipt.
- 1:45–1:55 — Grow: lend MUSD, show the cash share and the fee note.
- 1:55–2:00 — Close: "Real MUSD on Mezo. Links, loans, receipts."

## Honest note for judges

Everything this app does is live on the Mezo test network: balances, prices,
bills, payments, receipts, borrowing and lending. Bills are requests, not
tokens; payments are real wallet transactions with public receipts. The pool
price is posted by the pool owner; the app refreshes it automatically when the
owner is connected and pauses new loans if it is over 15 minutes old. Main
network contracts are not deployed yet.
