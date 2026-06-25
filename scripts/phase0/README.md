# Phase 0 — Raydium CLMM NFT locker proof (devnet only)

This folder contains **isolated devnet proof tooling** for investigating whether CBS Token Locker can custody Raydium CLMM position NFTs. It is **not** production CLMM support and does not change the deployed locker program or the production UI.

## Scope

- **Devnet only** — `proof-env.ts` hard-codes `PHASE0_NETWORK = 'devnet'` and never targets mainnet.
- **CLI keypair signing** — loads a local keypair from `PHASE0_KEYPAIR` or `~/.config/solana/id.json`.
- **No `@solana/web3.js`** — uses `@solana/kit` and existing repo Solana helpers under `src/solana/`.
- **No SPL/LP behavior changes** — production create/unlock flows are untouched.

## Files

| File | Purpose |
|------|---------|
| `proof-env.ts` | Devnet RPC helpers, program constants, Raydium devnet CLMM program ID, keypair loader |
| `proof-sign.ts` | Compile, sign, simulate, and send devnet transactions for upcoming track scripts |

## Environment

| Variable | Description |
|----------|-------------|
| `PHASE0_KEYPAIR` | Optional path to a Solana CLI keypair JSON file (default: `~/.config/solana/id.json`) |
| `VITE_SOLANA_RPC_DEVNET` | Optional devnet RPC URL (same as the app; falls back to public devnet) |
| `HELIUS_DEVNET_API_KEY` | Optional Helius devnet RPC |

## Planned proof tracks (not implemented yet)

- **Track B** — synthetic SPL NFT (supply 1, decimals 0)
- **Track A** — real Raydium SPL CLMM position NFT on devnet
- **Track C** — Token-2022 CLMM NFT (expected program limitation)

## Running

There is **nothing to run yet**. Foundation modules are imported by future `scripts/phase0/track-*.ts` scripts via `tsx`, for example:

```bash
# (future) npx tsx scripts/phase0/track-b-synthetic-nft.ts
```

Do **not** enable CLMM in the production UI until Phase 0 proof results and any required program changes are complete.
