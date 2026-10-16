# MezoFlow

Ask for dollars (MUSD) with a link, and get paid straight into your wallet on Mezo.

Every payment runs through your wallet. MezoFlow never moves money by itself.

## What it does

| Page            | What you do there                                                      |
| --------------- | ---------------------------------------------------------------------- |
| `/`             | Home: live Bitcoin price and links to everything                       |
| `/dashboard`    | Your home: wallet money, open bills, past payments                     |
| `/borrow`       | Loan planner: what your Bitcoin could borrow at 3 safety levels        |
| `/earn`         | How Mezo savings grow your MUSD into Bitcoin                           |
| `/pay`          | Make payment links with a scan code                                    |
| `/checkout`     | Pay a bill: straight from your wallet, or through the payment contract |
| `/activity`     | Every payment you made, newest first, with receipts                    |
| `/how-it-works` | Short guide                                                            |

## Money in plain words

- **MUSD** is a dollar that lives on Mezo, backed by Bitcoin.
- **MEZO** is Mezo's own coin for lower fees and votes.
- **Safety level** is how much extra Bitcoin backs a loan. Below 110% Mezo closes the loan. Mezo asks for at least 1,800 MUSD per loan.
- **Payment contract** (`InvoiceRouter`) moves money for bigger bills after you approve it once, and keeps a public receipt.

## Borrowing

Our own pool contract holds the money. Lenders put MUSD in, borrowers lock
Bitcoin and borrow at 250/200/150% safety. Under 110% anyone can close a loan:
pay what it owes, keep its Bitcoin. Loans cost 1% per year, counted every
second, paid to lenders. Deploys in Remix — see `contracts/README.md`.

## Money addresses (Mezo test network)

| Thing            | Address                                                                             |
| ---------------- | ----------------------------------------------------------------------------------- |
| MUSD             | `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`                                        |
| Payment contract | `0x99A9554C090C206a3811604448E5a29CAaB00d45` (first deployed version)               |
| Lending pool     | `VITE_VAULT_ADDRESS_TESTNET` (deploy `contracts/FlowVault.sol`)                     |
| Network          | Chain 31611, `https://rpc.test.mezo.org`, explorer `https://explorer.test.mezo.org` |

Main network MUSD: `0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186`.

## Buildathon (AKINDO OVOO0gdrVU8379D10 — Build with MUSD and MEZO)

- **Covers both tracks:** 1) money that works (payments, payment contract), 2) money more people can use (links, scan codes, plain words).
- **Runs on:** Mezo test network 31611 (main network ready).
- **For:** Bitcoin holders who want dollar spending money; freelancers and small shops billing in MUSD.
- **Built with:** TanStack Start v1, React 19, Vite 8, Tailwind v4, `viem` (payment contract calls only), Solidity 0.8.20 (payment contract, no extra pieces).
- **Proof:** payment contract above + its first deploy receipt `0x631a15b33f687cbe5120f3841f3e052f3afeaeb4a1eec50bec190fad70df5338` (block 16173807).
- **Extra settings (optional):** `VITE_ROUTER_ADDRESS_TESTNET`, `VITE_ROUTER_ADDRESS_MAINNET`, `VITE_MEZO_TOKEN_TESTNET`, `VITE_MEZO_TOKEN_MAINNET`. See `.env.example`.

## Checks before sending in

1. `bun install; bunx vitest run; bun run build` — all green.
2. Open the app, connect, switch to Mezo, check your money shows.
3. Make a link, pay it both ways (Pay now + Approve and pay), see both receipts under Past payments.

## Development

```sh
bun install
bun run dev
bunx vitest run
```
