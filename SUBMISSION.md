# Submission Pack — MezoFlow

## Live proof (Mezo test network 31611)

- Payment contract: `0x99A9554C090C206a3811604448E5a29CAaB00d45` (verified `InvoiceRouter`)
- Deploy receipt: `0x631a15b33f687cbe5120f3841f3e052f3afeaeb4a1eec50bec190fad70df5338` (block 16173807)
- Lending pool: `0x241af24502bD8DC163c1163Cdb35E9845510544f` (`FlowVault`)
- MUSD test network: `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`
- Explorer: `https://explorer.test.mezo.org`

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
