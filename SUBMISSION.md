# Wave 1 Submission Pack — MezoFlow

## On-chain proof (Mezo testnet 31611)
- InvoiceRouter: `0x99A9554C090C206a3811604448E5a29CAaB00d45` (verified `InvoiceRouter`)
- Deploy tx: `0x631a15b33f687cbe5120f3841f3e052f3afeaeb4a1eec50bec190fad70df5338` (block 16173807)
- MUSD testnet: `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`
- Explorer: `https://explorer.test.mezo.org`

## Self-test (do before recording)
1. `bun install; bun run dev` → open localhost URL from terminal.
2. Connect wallet → switch to Mezo Testnet (31611) → fund BTC via `https://faucet.test.mezo.org`.
3. Borrow page → On-chain panel Refresh → MUSD balance reads via `eth_call`.
4. Pay → create invoice → Open checkout → Pay from MUSD balance (real `transfer`) → Activity shows `on-chain` + receipt.
5. Checkout credit tab → Sign invoice (EIP-712, verifying = router `0x99A9…`) → Approve + Pay via Router → `InvoicePaid` event on explorer.
6. Activity → every row has explorer link; real rows resolve, simulated rows labeled.

## AKINDO fields
- Tracks: 1 DeFi + 2 Access & Distribution
- Chain: Mezo testnet (mainnet-ready)
- Target: BTC holders wanting dollar liquidity; freelancers/SMBs billing in MUSD; mobile + desktop, global
- Stack: TanStack Start v1, React 19, Vite 8, Tailwind v4, raw EIP-1193 + viem (router encoding only), Solidity 0.8.20 (zero-import router)
- Repo: `https://github.com/dinitheth/Mezo-Credits` + live URL + demo video (2-3 min: connect → real transfer → router pay → activity)

## Demo script (2 min)
0:00 connect + switch to Mezo → 0:20 On-chain panel refresh → 0:40 wallet-pay real hash → 1:00 EIP-712 sign → 1:20 Approve + Pay via Router → 1:40 Activity `on-chain` + explorer `InvoicePaid`.
