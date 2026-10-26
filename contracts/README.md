# Contracts — deploy in 5 minutes each (Remix, no toolchain)

Both have zero imports. Compiler `0.8.20`, optimizer on, EVM default.

## InvoiceRouter — payments

The earlier testnet deployment at `0x99A9554C090C206a3811604448E5a29CAaB00d45` has a signature parsing bug and cannot settle receipt-based bills. Contracts cannot be upgraded in place; deploy the corrected source as a new router:

1. In Remix, open `contracts/InvoiceRouter.sol` and compile with Solidity `0.8.20`, optimizer on, EVM default.
2. Connect the wallet to Mezo testnet (chain `31611`) and deploy `InvoiceRouter` with MUSD constructor address `0x118917a40FAF1CD7a13DB0Ef56C86De7973Ac503`.
3. Set `VITE_ROUTER_ADDRESS_TESTNET` to the new router address in the hosting provider, then redeploy the app.
4. Test with a small bill and confirm the `payInvoice` transaction succeeds and emits `InvoicePaid` before using it for other payments.

## FlowVault — our own lending pool (live)

Deployed (Mezo testnet 31611): `0x241af24502bD8DC163c1163Cdb35E9845510544f`
Deploy receipt: `0x32fb9682c1184ba38db2863547d7d3a9a03f22c988a94b2a3e4ed7d5ff9419a4` (block 16187528).

1. Remix → new file `FlowVault.sol` → paste `contracts/FlowVault.sol`.
2. Compile `0.8.20`, optimizer on.
3. Browser Extension → Mezo Testnet (chain `31611`).
4. Deploy → constructor `_musd` = `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`.
5. Copy the pool address → `.env`: `VITE_VAULT_ADDRESS_TESTNET=0x…`.
6. Fund it: Grow page → Lend MUSD.
7. First loan: if the pool shows no prices, its owner taps once on Borrow to post them.

How money moves in the pool:

- Lenders put MUSD in and get shares. Shares grow when borrowers repay their fees.
- Borrowers lock Bitcoin and take MUSD at 250/200/150% safety.
- Under 110% anyone can close a loan: pay what it owes, keep its Bitcoin.
- Loans cost 1% per year, counted every second, added to the pool when repaid.
