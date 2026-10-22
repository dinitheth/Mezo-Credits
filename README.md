# MezoFlow

Ask for dollars (MUSD) with a link, and get paid straight into your wallet on Mezo.

Every payment runs through your wallet. MezoFlow never moves money by itself.

## What it does

| Page            | What you do there                                                      |
| --------------- | ---------------------------------------------------------------------- |
| `/`             | Home: live Bitcoin price and links to everything                       |
| `/dashboard`    | Your loan, wallet money and the things you can do                      |
| `/borrow`       | Lock Bitcoin and borrow MUSD from the pool at 3 safety levels          |
| `/earn`         | Lend MUSD to the pool and earn borrower fees                           |
| `/pay`          | Make payment links with a scan code                                    |
| `/checkout`     | Pay a bill: straight from your wallet, or through the payment contract |
| `/activity`     | Every payment you made, newest first, with receipts                    |
| `/how-it-works` | Short guide                                                            |

## Money in plain words

- **MUSD** is a dollar that lives on Mezo, backed by Bitcoin.
- **MEZO** is Mezo's own coin for lower fees and votes.
- **Safety level** is how much extra Bitcoin backs a loan. Below 110% anyone can close the loan by paying what it owes and keeping the Bitcoin.
- **Payment contract** (`InvoiceRouter`) moves money for bigger bills after you approve it once, and keeps a public receipt.

## Borrowing and savings

Our own pool contract holds the money. Lenders put MUSD in, borrowers lock
Bitcoin and borrow at 250/200/150% safety. Under 110% anyone can close a loan:
pay what it owes, keep its Bitcoin. Loans cost 1% per year, counted every
second, paid to lenders. Deploys in Remix — see `contracts/README.md`.

The pool price is posted by the pool owner. The app shows how old it is and
pauses new loans after 15 minutes until the owner refreshes it, so a loan is
never priced off a stale number.

## Money addresses (Mezo test network)

| Thing            | Address                                                                             |
| ---------------- | ----------------------------------------------------------------------------------- |
| MUSD             | `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`                                        |
| Payment contract | `0x99A9554C090C206a3811604448E5a29CAaB00d45` (first deployed version)               |
| Lending pool     | `0x241af24502bD8DC163c1163Cdb35E9845510544f` (first deployed version)               |
| Network          | Chain 31611, `https://rpc.test.mezo.org`, explorer `https://explorer.test.mezo.org` |

Main network MUSD: `0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186`. The payment
contract and the pool are not deployed on the main network yet; the app only
uses the test network until those addresses are set.

## Buildathon (AKINDO OVOO0gdrVU8379D10 — Build with MUSD and MEZO)

- **Covers both tracks:** 1) money that works (payments, payment contract, lending pool), 2) money more people can use (links, scan codes, plain words).
- **Runs on:** Mezo test network 31611. Main network contracts are not deployed yet.
- **For:** Bitcoin holders who want dollar spending money; freelancers and small shops billing in MUSD.
- **Built with:** TanStack Start v1, React 19, Vite 8, Tailwind v4, `viem`, Solidity 0.8.20 (`InvoiceRouter` and `FlowVault`).
- **Proof:** payment contract above + its first deploy receipt `0x631a15b33f687cbe5120f3841f3e052f3afeaeb4a1eec50bec190fad70df5338` (block 16173807).
- **Extra settings (optional):** `VITE_ROUTER_ADDRESS_TESTNET`, `VITE_ROUTER_ADDRESS_MAINNET`, `VITE_VAULT_ADDRESS_TESTNET`, `VITE_VAULT_ADDRESS_MAINNET`, `VITE_FLOW_START_BLOCK_TESTNET`, `VITE_MEZO_TOKEN_TESTNET`, `VITE_MEZO_TOKEN_MAINNET`. See `.env.example`.
- **Global wallet kit (optional):** set `VITE_DYNAMIC_ENVIRONMENT_ID` (from https://app.dynamic.xyz) to let people sign in with email or a wallet of their choice. Coinbase Wallet is left out on purpose. Without the setting, the app uses the built-in wallet connection.

## Checks before sending in

1. `bun install; bunx vitest run; bun run build` — all green. Tests live in `tests/`.
2. Open the app, connect, switch to Mezo, check your money shows.
3. Make a link, pay it both ways (Pay now + Approve and pay), then find the receipt under Past payments and the payment under Money received.
4. Borrow from the pool and lend MUSD on the Grow page; both write real receipts.

## Development

```sh
bun install
bun run dev
bunx vitest run
```
