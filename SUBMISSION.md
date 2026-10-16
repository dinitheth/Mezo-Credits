# Wave 1 Submission Pack — MezoFlow

## Live proof (Mezo test network 31611)

- Payment contract: `0x99A9554C090C206a3811604448E5a29CAaB00d45` (verified `InvoiceRouter`)
- Deploy receipt: `0x631a15b33f687cbe5120f3841f3e052f3afeaeb4a1eec50bec190fad70df5338` (block 16173807)
- MUSD test network: `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`
- Explorer: `https://explorer.test.mezo.org`

## Try it yourself

1. `bun install; bun run dev` → open the localhost address from the terminal.
2. Connect wallet → switch to Mezo → check your money shows.
3. Get paid page → make a link → open the pay page → Pay now → see the receipt under Past payments.
4. Same bill → Approve and pay → see the contract receipt on Mezo.
5. Borrow planner → type Bitcoin → compare the three safety levels (live price).

## AKINDO answers

- Tracks: 1 (money that works) + 2 (money more people can use)
- Network: Mezo test network (main network ready)
- For: Bitcoin holders who want dollar spending money; freelancers and small shops billing in MUSD
- Built with: TanStack Start v1, React 19, Vite 8, Tailwind v4, `viem`, Solidity 0.8.20
- Repo: `https://github.com/dinitheth/Mezo-Credits` + live URL + demo video (2 min: connect → pay now → approve and pay → past payments)

## Honest note for judges

Mezo has not published its loan contracts for apps, so loans open in the Mezo
app. Everything this app does — balances, prices, payments, receipts — is live.
Nothing is mocked.
