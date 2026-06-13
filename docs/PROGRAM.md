# CBS Token Locker Program

Open-source Solana program for verifiable SPL and LP token locks.

## Program ID

| Cluster | Program ID |
|---|---|
| Localnet / Devnet (current) | `DA1sh6XTa13QQ23sLNdcPfCZF5SGMKXXYLxcfAJYcCmU` |
| Mainnet | Deployed via governed release. Set `VITE_CBS_LOCKER_PROGRAM_ID` after deployment. |

## Design Goals

- Deterministic lock accounts derived from owner, mint, and lock seed
- Program-controlled token vault accounts
- On-chain unlock timestamp enforced by the Solana clock
- Owner-only unlock after unlock time
- No admin withdrawal path
- SPL token support in version 1
- LP token account support in version 1
- Token-2022 support prepared via stored `token_program` field

## Account Layout

### `TokenLock`

| Field | Type | Notes |
|---|---|---|
| owner | Pubkey | Original locker wallet |
| mint | Pubkey | Locked token mint |
| vault | Pubkey | Program vault token account |
| amount | u64 | Locked amount in base units |
| unlock_timestamp | i64 | Unix timestamp |
| created_at | i64 | Unix timestamp |
| lock_seed | u64 | Deterministic seed for multiple locks |
| token_type | u8 | `0` = SPL, `1` = LP |
| is_unlocked | bool | Set after successful unlock |
| bump | u8 | Lock PDA bump |
| vault_bump | u8 | Vault PDA bump |
| token_program | Pubkey | SPL or future Token-2022 program |
| project_name | [u8; 48] | On-chain project label |

### PDA Seeds

- Lock account: `["lock", owner, mint, lock_seed_le_bytes]`
- Vault account: `["vault", lock_account]`

## Instructions

### `create_lock`

Creates the lock account and vault, validates mint/amount/owner, and deposits tokens.

### `unlock`

Allows only the original owner to withdraw after `unlock_timestamp`.

Early unlock is rejected on-chain.

## Build and Deploy

Requires Solana CLI and Anchor 0.31.1.

```bash
anchor build
anchor deploy --provider.cluster devnet
```

## Public Verification

All lock state must be readable from chain. The frontend and `/api/v1` endpoints verify:

- Program ownership
- Account discriminator and layout
- Deterministic PDA derivation
- Vault mint, authority, and balance

## DEX Recognition

The architecture is designed for future submission to ecosystem scanners and trust platforms such as DEXTools, RugCheck, DexScreener, Birdeye, Jupiter, and Raydium tooling.

DEX recognition is planned. The program does not claim approval or official recognition.
