# MezoFlow

Bitcoin-backed MUSD credit lines and instant invoice settlement on Mezo.

> **Simulated operations.** Wallet connection, network switching, `eth_call` balance reads, testnet MUSD transfers and EIP-712 signatures are real (EIP-1193 via `window.ethereum`).
> Trove collateral/debt/pool figures, minting, repayments, Stability Pool rewards, the liquidation shield and
> invoice credit-mints are **simulated in the browser** and persisted to `localStorage`. Simulated transaction hashes are
> random (`fakeTx()`); explorer links will not resolve. On-chain transfers are marked `on-chain` in `/activity` and resolve. Connecting a wallet does not provide on-chain credit or payments by itself.

## Buildathon (AKINDO OVOO0gdrVU8379D10 — Build with MUSD and MEZO)
- **Tracks:** 1 DeFi (borrow/lend/loop/yield) + 2 Access & Distribution (pay links, QR, checkout). This build submits to both.
- **Chains:** Mezo testnet 31611 (Wave 1 live leg), Mezo mainnet 31612 ready, Ethereum/Base/BNB Chain supported for deployment. Testnet accepted per rules.
- **Target group:** BTC holders who want dollar liquidity without selling; freelancers/SMBs billing in MUSD; mobile + desktop, global, beginner-friendly (tier presets, gauge, shield).
- **Tech stack:** TanStack Start v1, React 19, Vite 8, Tailwind v4, EIP-1193 raw provider (no viem/ethers), `qrcode.react`, zod. On-chain layer in `src/lib/onchain.ts`.
- **Hard requirements met:** MUSD integration (ERC-20 reads + testnet transfer write + EIP-712 invoice intent), working deployment (deploy this build + set live URL here), built during hackathon, extends MUSD/MEZO utility.
- **Env:** `VITE_MEZO_TOKEN_TESTNET` / `VITE_MEZO_TOKEN_MAINNET` (0x addresses, optional — UI falls back gracefully when unset).
- **Demo checklist (Wave 1):** connect → switch to Mezo testnet → On-chain panel refresh → Checkout Pay from MUSD balance (real hash) → Activity shows `on-chain` + receipt → Pay with Credit (simulated mint) + EIP-712 sign.

## Stack
TanStack Start v1 (React 19, SSR, file routes), Vite 8, Tailwind CSS v4 (tokens in `src/styles.css`), lucide icons, `qrcode.react`, zod for search params. On-chain reads/writes are raw EIP-1193 in `src/lib/onchain.ts` (no extra deps).

## Routes
| Path | Purpose |
| --- | --- |
| `/` | Landing page |
| `/dashboard` | Trove position, health score, gauge, repay / add / withdraw collateral, Liquidation Shield |
| `/borrow` | 1-click credit line (`CreditForm`): tiers 250/200/150% CR, price simulator, auto-route to pool |
| `/earn` | Stability Pool: APY, total staked, deposit, BTC rewards; deposit / withdraw / claim / compound |
| `/pay` | Invoice generator, payment links, QR codes, download + share |
| `/checkout` | Payer view (`?id&amount&to&desc`): QR, MUSD/BTC/sats breakdown, Pay with Credit or from balance |
| `/activity` | Ledger of every action with filter, status and explorer link |
| `/how-it-works` | Architecture page: Router, Troves, Stability Pool, EIP-712, dual tokens, track bridge |

## Architecture plan
```text
 Browser (TanStack Start, SSR)
 ┌───────────────────────────────────────────────┐
 │ Routes: / dashboard borrow earn pay checkout  │
 │         activity how-it-works                 │
 │   │ UI (Shell, CreditForm, ui-bits)           │
 │   ▼                                           │
 │ src/lib/mezo.ts store ──► localStorage        │
 │   ├ logActivity() → /activity ledger          │
 │   ├ usePriceFeed + simTick (rewards, shield)  │
 │   └ connectWallet / switchToMezo ─► wallet    │
 └───────────────────────────────────────────────┘
 Target on-chain flow (simulated today):
 Wallet ─sign EIP-712─► MezoFlow Router ─► Trove Manager ─mint─► MUSD
                                   └──► Stability Pool | Invoice recipient
```
Planned phases: (1) current simulated UI; (2) wire Router/Trove/Pool contract addresses + ABI reads; (3) EIP-712 relayed checkout; (4) indexer-backed activity history.

## Input validation
All amount fields go through `cleanNum()` (`ui-bits.tsx`): digits and one decimal point only (BTC up to 8 decimals, MUSD up to 2). Actions stay disabled for zero/empty values or amounts above balance; recipient must match `^0x[0-9a-fA-F]{40}$`.

## Theme
Light (cream) is the default; dark is opt-in via the header toggle and saved in `localStorage["mezoflow-theme"]`.

## State (`src/lib/mezo.ts`)
A tiny external store (`useSyncExternalStore`). Persisted under `localStorage["mezoflow"]`:
`position {collateral BTC, debt MUSD, pool MUSD}`, `invoices[]`, `activity[]` (max 500, each with optional `onchain` flag), `rewardsBtc`, `shield {enabled, trigger, alerts}`.
Not persisted: `account`, `chainId`, `btcPrice`. Theme: `localStorage["mezoflow-theme"]`. `hydrateStore()` runs in `Shell` after mount to avoid SSR mismatches.

Every mutation calls `logActivity(kind, amount, unit, note?, tx?, onchain?)`, which creates a ledger entry and returns its tx hash. Invoice creation logs `invoice_created`; real wallet broadcasts pass `onchain=true` and `/activity` shows receipt status via `eth_getTransactionReceipt`.

## Math
- `CR = collateral × price × 100 / debt` (`crOf`); liquidation floor `MIN_CR = 110`.
- Liquidation price = `debt × 1.10 / collateral` (`liqPrice`).
- Borrow power at tier = `btc × price × 100 / tierCR`.
- Withdrawable collateral keeps `CR ≥ SAFE_CR (150)`: `max = collateral − debt × 1.5 / price`.
- Wallet MUSD (available to deposit to pool) = `debt − pool`.
- Health score bands: ≥200% healthy, ≥150% moderate, else at risk.
- Protocol cost (`src/lib/onchain.ts`): 1% borrowing fee + 200 MUSD gas comp; `expectedTotalDebt = mint + fee + 200`; minimum borrow 1,800 MUSD (2,000 total debt). `CreditForm` shows fee/total/effective CR and warns when a demo amount is under the real minimum instead of blocking simulation.

## Simulation loop (`usePriceFeed`, active on `/dashboard` and `/earn`)
Every 3 s: BTC price random walk (±0.2%), then `simTick()`:
1. Accrues pool rewards in BTC: `pool × APY / year × 3 s × 1000 / price` (1000× speed-up for demos).
2. If shield is enabled and CR < trigger, repays from the pool deposit enough to restore `trigger + 15%`, logged as `shield_repay`.
3. If alerts are on and permission granted, sends a browser `Notification` (max once a minute).

## Workflows
- **Borrow:** deposit BTC → mint MUSD → optional pool deposit. Logs `add_collateral`, `borrow`, `pool_deposit`.
- **Pay with Credit:** checkout sizes collateral to the invoice at the chosen tier, mints exactly the invoice amount, marks it paid, logs `invoice_paid`.
- **Invoices:** encoded entirely in the checkout URL, so links/QRs work across devices, but "paid" status only updates in the browser that paid.
- **Earn:** claim to wallet (`claim_rewards`) or compound into Trove collateral (`compound_rewards`).

## Network
Wallet chain constants in `MEZO` (`src/lib/mezo.ts`): Mezo testnet 31611 / mainnet 31612 RPC/explorer. Token/fee constants in `src/lib/onchain.ts` (`MUSD_TOKEN`, `MEZO_TOKEN`, `SUPPORTED_CHAINS`). Display copy is kept separate from these constants; changing copy must not change RPC endpoints.

| Asset | Mezo testnet | Mezo mainnet |
| --- | --- | --- |
| MUSD (18dp) | `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` | `0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186` |
| MEZO (18dp) | `VITE_MEZO_TOKEN_TESTNET` (unset = documented fallback) | `VITE_MEZO_TOKEN_MAINNET` (unset = documented fallback) |
| Chain | 31611 `https://rpc.test.mezo.org` | 31612 |
| Explorer | `https://explorer.test.mezo.org` | Mezo explorer |
| InvoiceRouter | `VITE_ROUTER_ADDRESS_TESTNET` (deploy `contracts/InvoiceRouter.sol` via Remix, see `contracts/README.md`) | `VITE_ROUTER_ADDRESS_MAINNET` |

Live legs: `eth_call` MUSD/MEZO balances + block number (`OnchainPanel`), `eth_sendTransaction` MUSD transfer (Checkout wallet pay), `eth_signTypedData_v4` invoice delegation + `InvoiceRouter.payInvoice` (Checkout credit tab, needs MUSD `approve` first), `eth_getTransactionReceipt` status (`/activity`). Trove `BorrowerOperations` wiring remains phase 2.

## Development
```sh
bun install
bun run dev
bunx vitest run
```
