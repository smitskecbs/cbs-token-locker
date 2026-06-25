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
| `track-b-synthetic-nft.ts` | Track B — lock/unlock a synthetic legacy SPL NFT (supply 1, decimals 0) on devnet |

## Environment

| Variable | Description |
|----------|-------------|
| `PHASE0_KEYPAIR` | Optional path to a Solana CLI keypair JSON file (default: `~/.config/solana/id.json`) |
| `PHASE0_TRACK_B_MINT` | Synthetic NFT mint for Track B (or pass as first CLI argument) |
| `PHASE0_LOCK_SEED` | Optional lock seed integer (default: current timestamp ms) |
| `PHASE0_UNLOCK_DELAY_SECONDS` | Seconds until unlock (default: `30`) |
| `PHASE0_PROJECT_NAME` | Optional lock project name (default: `Phase0 Track B`) |
| `VITE_SOLANA_RPC_DEVNET` | Optional devnet RPC URL (same as the app; falls back to public devnet) |
| `HELIUS_DEVNET_API_KEY` | Optional Helius devnet RPC |

## Proof tracks

- **Track B** — synthetic SPL NFT (supply 1, decimals 0) — `track-b-synthetic-nft.ts`
- **Track A** — real Raydium SPL CLMM position NFT on devnet (planned)
- **Track C** — Token-2022 CLMM NFT (expected program limitation, planned)

## Running

### Track B — synthetic SPL NFT

Prerequisites: devnet keypair holds exactly **1** token of a legacy SPL mint with **0** decimals.

```bash
npx tsx scripts/phase0/track-b-synthetic-nft.ts <MINT_ADDRESS>
```

Or with env:

```bash
PHASE0_TRACK_B_MINT=<MINT_ADDRESS> npx tsx scripts/phase0/track-b-synthetic-nft.ts
```

Optional shorter unlock window:

```bash
PHASE0_UNLOCK_DELAY_SECONDS=15 npx tsx scripts/phase0/track-b-synthetic-nft.ts <MINT_ADDRESS>
```

Do **not** enable CLMM in the production UI until Phase 0 proof results and any required program changes are complete.
