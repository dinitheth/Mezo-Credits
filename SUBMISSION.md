# Submission Pack — MezoFlow

## Live proof (Mezo test network 31611)

| Item | Value |
| --- | --- |
| Payment contract (v1) | `0x99A9554C090C206a3811604448E5a29CAaB00d45` — known signature bug; corrected source is ready in `contracts/InvoiceRouter.sol` |
| Payment deploy receipt | `0x631a15b33f687cbe5120f3841f3e052f3afeaeb4a1eec50bec190fad70df5338` (block 16173807) |
| Lending pool (v1) | `0x241af24502bD8DC163c1163Cdb35E9845510544f` — owner-posted price; oracle-priced source is ready in `contracts/FlowVault.sol` |
| Pool deploy receipt | `0x32fb9682c1184ba38db2863547d7d3a9a03f22c988a94b2a3e4ed7d5ff9419a4` (block 16187528) |
| MUSD test network | `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` |
| Mezo `PriceFeed` | `0x86bCF0841622a5dAC14A313a15f96A95421b9366` |
| Mezo `TroveManager` | `0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0` |
| Explorer | `https://explorer.test.mezo.org` |

The two v1 contracts above are the deployments a judge can inspect today. The replacements are written, compile, pass 10 contract tests, and are ready to deploy from the browser wallet at [`/deploy.html`](https://mezocredits.vercel.app/deploy.html). Their new addresses cannot be listed until that wallet-signed deployment happens. Exact constructor arguments and steps are in [`contracts/README.md`](contracts/README.md).

## Where each judging criterion is proven

| Criterion | Proof in this repo |
| --- | --- |
| Mezo integration | `FlowVault` prices every loan with Mezo's official `PriceFeed` (`fetchPrice()`), not an app-set number. `src/lib/onchain.ts` reads the same feed plus `TroveManager` system totals and the wallet's trove, and `MezoProtocolCard` shows them live. MUSD is the money moved for payments, loans and deposits. Every recorded action has a real wallet receipt. No mocked balances or hashes. |
| Product and business viability | A payer needs only a wallet on Mezo; a payee makes a link in seconds. First users are freelancers and small shops already paid in MUSD, plus Bitcoin holders who want dollars without selling. Revenue path and risks are stated below. |
| Technical implementation | `contracts/FlowVault.sol` (share value includes principal out on loan, 1%/year fee, 110% close floor, 150% backing floor, oracle reads, no owner), `contracts/InvoiceRouter.sol`, `src/lib/onchain.ts`, `src/lib/bills.ts`. 93 app tests and 10 contract tests pass; typecheck and production build pass. |
| User experience | Plain-word pages, no protocol jargon; Disconnect; friendly failure text that says nothing moved; mobile layout; QR codes and receipt links. Borrowing pauses with a plain message when Mezo's price is stale instead of using an old number. |
| Submission materials | This file, `README.md`, `contracts/README.md`, the deck at `public/deck.html`, the test suites, and the demo script below. |

## Who it is for and how it could pay for itself

- **First users:** freelancers and small shops already paid in MUSD, and Bitcoin holders who want spending money without selling their Bitcoin.
- **Why they switch:** a payment link is easier to try than a new account, and the payer only needs a wallet on Mezo.
- **Revenue path (not switched on yet):** keep a small share of the 1% yearly borrower fee, or add a flat fee per paid bill. Lenders keep the rest. No fee is charged today.
- **Risks:** pool liquidity, smart-contract risk, and dependence on Mezo's oracle freshness. Borrowing and closing pause while the oracle is stale; lending and repayment keep working. Contracts are small and tested but not audited.
- **Traction:** No public users yet. This is a testnet prototype; every recorded payment and loan is our own test transaction, with a public receipt. No numbers are invented.

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
6. Grow page → lend MUSD → see cash free, money out on loan, and your share.

## AKINDO form answers

- **Project name:** MezoFlow
- **Category:** Payments and borrowing
- **TL;DR:** MezoFlow turns MUSD into spendable money: payment links with real receipts, plus a pool where Bitcoin holders borrow MUSD and savers lend it.
- **How it works:** Freelancers and shops get paid in dollars but hold Bitcoin. A payee makes a bill in seconds and shares a link or QR code; the payer connects a Mezo wallet and chooses: pay straight to the wallet, or pay through `InvoiceRouter` for a public receipt. Bills are plain records, so the payee's page marks them paid on any device by reading the contract's `InvoicePaid` events; a direct payment still lands under Money received with its wallet receipt. On the credit side, Bitcoin holders lock BTC in `FlowVault` and borrow MUSD at 150/200/250% safety, priced by Mezo's `PriceFeed`; lenders deposit MUSD, and the 1% yearly fee is added to the pool when loans are repaid. Share value counts cash plus money out on loan, so new lenders do not dilute existing ones. MUSD is the unit of account for every bill, the asset borrowers receive, and the asset lenders earn. MEZO is not needed for the core flow; it is the network's fee and governance coin.
- **Target group:** Freelancers, small shops and Bitcoin holders. No DeFi knowledge assumed: the payer only needs a wallet on Mezo, and every screen uses plain words. Mobile-first for paying and sharing; desktop for managing a loan or a pool position. Global, English. Fits Track 1 because money actually moves, and Track 2 because links and plain words lower the entry bar.
- **Tech stack:** TanStack Start v1, React 19, Vite 8, Tailwind v4, TypeScript, RainbowKit, wagmi, `viem`, Solidity 0.8.20+, Mezo testnet RPC, Vitest (93 app tests) and a solc + EVM harness (10 contract tests).
- **Track:** Both.
- **Chain deployed on:** Mezo test network (chain 31611). Main network contracts are not deployed.
- **Project status:** Existing project, extended during the hackathon. The first version had MUSD payment links and a lending pool with an owner-set price. This round added Mezo's `PriceFeed` and `TroveManager` reads, share accounting that counts money out on loan, 10 contract tests, the corrected router, a deploy page, and a deck. Previous site: `https://mezocredits.vercel.app/`.
- **Project readiness:** Testnet prototype. Corrected contracts are ready; deployment is the next step.
- **Future milestones:**
  1. Now: deploy the corrected `InvoiceRouter` and the oracle-priced `FlowVault`, verify one payment and one loan end to end.
  2. 4–6 weeks: indexer plus notifications (email/Telegram) for bills, installable PWA for shops, batch payout view.
  3. 3 months: pilot with 5–10 merchants, independent contract review, switch on a small fee.
- **Team:** Dinith — solo build: contracts, app, and design. _Add an X or LinkedIn link before submitting._
- **Repo:** `https://github.com/dinitheth/Mezo-Credits`
- **Live app:** `https://mezocredits.vercel.app/`
- **Deck:** `https://mezocredits.vercel.app/deck.html`
- **Pitch video (2 min):** _re-upload and link a public video; the previously linked video is not publicly playable._

### If this is a Wave 2 resubmission

Since Wave 1 this repo added: an oracle-priced `FlowVault` with no owner key and no price setter, share accounting that includes principal out on loan, live Mezo `PriceFeed` and `TroveManager` reads in the app, 10 contract tests, the corrected `InvoiceRouter` source, plain-word failure text for a stale oracle, and a deck. The app suite has 93 passing tests.

## Deck

An 8-slide deck lives at [`public/deck.html`](public/deck.html) and is served at `/deck.html` on the live app. Print it to PDF from the browser if a PDF is required.

1. **Title** — MezoFlow · MUSD payments and borrowing · testnet live · repo link.
2. **Problem** — freelancers and shops bill in dollars; Bitcoin holders do not want to sell; wallets can send but do not reconcile bills.
3. **Solution** — payment link or QR → pay in MUSD → public receipt; borrow against Bitcoin; lend MUSD for fees when loans repay.
4. **Demo** — bill, checkout, Money received, Borrow.
5. **Mezo fit** — MUSD as unit of account, credit asset and lender fee income; loans priced by Mezo's `PriceFeed`; trove totals read from `TroveManager`.
6. **How it works** — browser → wallet → Mezo RPC → `InvoiceRouter` / `FlowVault` → Mezo `PriceFeed`; event scan reconciles bills.
7. **Users and business** — first users, wedge, revenue path, honest risks.
8. **Roadmap and team** — deploy replacements, indexer, pilot; team and links.

## Two-minute video shot list (hard cap 2:15)

- 0:00–0:15 — "Bitcoin holders need dollars without selling. Shops need to get paid in dollars."
- 0:15–0:40 — Get paid: type 25 MUSD, make the link, show the QR code.
- 0:40–1:05 — Pay page: choose "Approve and pay"; show the bill turn Paid with its receipt.
- 1:05–1:20 — Money received: show the payment and open the explorer receipt.
- 1:20–1:45 — Borrow: lock Bitcoin, borrow MUSD, show the receipt.
- 1:45–2:00 — Grow: lend MUSD, show cash free, money out on loan, and your share.
- 2:00–2:10 — Mezo card: live price and system totals from Mezo's contracts.
- 2:10–2:15 — Close: "Real MUSD on Mezo. Links, loans, receipts."

## Honest note for judges

Everything this app does is live on the Mezo test network: balances, prices, bills, payments, receipts, borrowing and lending. Bills are requests, not tokens; payments are real wallet transactions with public receipts. The deployed v1 pool used an owner-posted price; the source in this repo replaces it with Mezo's `PriceFeed` and removes the owner entirely, and it is waiting on a funded deployment. Main network contracts are not deployed yet.
