# InvoiceRouter — deploy in 5 minutes (Remix, no toolchain)

No `npm`/`forge` needed. Contract has zero imports.

1. Open https://remix.ethereum.org → New file `InvoiceRouter.sol` → paste `contracts/InvoiceRouter.sol`.
2. Compile: Solidity `0.8.20`, EVM default, optimizer on.
3. Injected Provider: connect MetaMask/Rabby → **Mezo Testnet** (chain `31611`, RPC `https://rpc.test.mezo.org`).
   Get testnet BTC from `https://faucet.test.mezo.org`.
4. Deploy → constructor `_musd` = `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` (testnet MUSD).
5. Copy deployed address → frontend env:
   - `.env`: `VITE_ROUTER_ADDRESS_TESTNET=0xYourRouter…`
   - mainnet later: `VITE_ROUTER_ADDRESS_MAINNET=0x…`
6. Fund path per invoice: payer calls MUSD `approve(router, amount)` once, then Checkout → **Pay via Router** (sign EIP-712 → submit `payInvoice`).
7. Verify: `InvoicePaid` event + MUSD `Transfer(payer → to)` on `https://explorer.test.mezo.org`.

Notes:
- `nonce` is `Date.now()` per checkout — replay-safe per payer.
- `deadline` is +1h from signing.
- Router never holds funds; it only `transferFrom`s with allowance.
