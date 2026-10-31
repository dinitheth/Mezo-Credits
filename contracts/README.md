# Contracts

Both contracts have zero imports, so they compile and deploy from Remix with no toolchain. Solidity `0.8.20` or newer, optimizer on, EVM default.

## Tests

`FlowVault` has 10 tests. They compile the real contract with solc and run it in an in-process EVM, so no Docker, Foundry or hosted node is needed.

```sh
cd contracts
npm install
npm test
```

## Easiest deploy: the built-in page

`https://mezocredits.vercel.app/deploy.html` deploys both contracts from your own browser wallet, with the testnet addresses already filled in. It holds no keys and cannot move your money.

- Open the page, connect a wallet on Mezo testnet, and approve two transactions.
- Copy the two addresses it shows into the hosting settings as `VITE_ROUTER_ADDRESS_TESTNET` and `VITE_VAULT_ADDRESS_TESTNET`.
- Redeploy the app and test one small bill and one small loan.

The page is generated from the contracts in this folder. To rebuild and re-check it:

```sh
npm run build:deploy
npm run check:deploy
```

`check:deploy` deploys the exact embedded bytecode in a local EVM and checks that each contract points at the right MUSD and price feed. It catches a stale build before you spend testnet BTC on gas.

## InvoiceRouter — payments

The earlier testnet deployment at `0x99A9554C090C206a3811604448E5a29CAaB00d45` has a signature parsing bug and cannot settle receipt-based bills. Contracts cannot be upgraded in place; deploy the corrected source as a new router:

1. In Remix, open `contracts/InvoiceRouter.sol` and compile with Solidity `0.8.20`, optimizer on, EVM default.
2. Connect the wallet to Mezo testnet (chain `31611`) and deploy `InvoiceRouter` with the MUSD constructor address for that network.
3. Set `VITE_ROUTER_ADDRESS_TESTNET` to the new router address in the hosting provider, then redeploy the app.
4. Test with a small bill and confirm the `payInvoice` transaction succeeds and emits `InvoicePaid` before using it for other payments.

## FlowVault — our own lending pool

The source in this repo is the oracle-priced version. It has **no owner, no admin key and no price setter**. It reads BTC/USD from Mezo's official `PriceFeed` for every price-dependent action.

- Mezo testnet (31611): MUSD `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`, `PriceFeed` `0x86bCF0841622a5dAC14A313a15f96A95421b9366`
- Mezo mainnet (31612): MUSD `0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186`, `PriceFeed` `0xc5aC5A8892230E0A3e1c473881A2de7353fFcA88`

The earlier testnet vault at `0x241af24502bD8DC163c1163Cdb35E9845510544f` is the v1 contract with an owner-posted price. It cannot be upgraded; deploy the source here as a new vault and point the app at it:

1. Remix → new file `FlowVault.sol` → paste `contracts/FlowVault.sol`.
2. Compile `0.8.20` or newer, optimizer on.
3. Browser Extension → Mezo Testnet (chain `31611`).
4. Deploy with two constructor arguments: `_musd` and `_priceFeed` from the list above.
5. Copy the pool address → hosting env: `VITE_VAULT_ADDRESS_TESTNET=0x…`, then redeploy the app.
6. Fund it: Grow page → Lend MUSD.
7. Borrow a small amount and confirm the receipt. No price setup step exists; the pool uses Mezo's feed.

How money moves in the pool:

- Lenders put MUSD in and get shares. A share is worth `(cash + money out on loan) / all shares`, so new lenders cannot dilute existing lenders while loans are open.
- Borrowers lock Bitcoin and take MUSD at 250/200/150% safety, priced by Mezo's `PriceFeed`.
- Under 110% anyone can close a loan: pay what it owes, keep its Bitcoin.
- Loans cost 1% per year, counted every second. Fees stay in the pool as cash when repaid.
- A lender can withdraw only cash that is free. Money out on loan comes back as borrowers repay.
- If Mezo's oracle is stale, borrowing and closing revert with a plain message; lending and repayment still work.
