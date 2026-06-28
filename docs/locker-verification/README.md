# CBS Token Locker Verification Specification v1

This document describes how third parties can independently verify CBS Token Locker locks on Solana. It is intended for indexers, explorers, analytics platforms, wallets, and integration partners.

**Scope:** On-chain verification only. This specification does not describe UI behavior, deployment configuration, or third-party listing status.

---

## 1. What CBS Token Locker is

CBS Token Locker is a Solana program that lets a wallet deposit tokens or position assets into a program-controlled vault until a fixed unlock time. Each lock is represented by a dedicated on-chain account (a lock PDA) that stores the owner, mint, amount, unlock timestamp, token type, token program, and unlock state.

The program enforces:

- Deposits into a vault whose authority is the lock PDA
- Owner-only withdrawal after the stored unlock timestamp
- No admin withdrawal path for locked assets

Locks are intended to be **publicly verifiable** by reading Solana account data. No trust in the CBS website or API is required for on-chain verification.

---

## 2. Mainnet program ID

| Cluster | Program ID |
|---|---|
| Mainnet | `DA1sh6XTa13QQ23sLNdcPfCZF5SGMKXXYLxcfAJYcCmU` |
| Devnet | `DA1sh6XTa13QQ23sLNdcPfCZF5SGMKXXYLxcfAJYcCmU` |

The same program ID is used on Devnet and Mainnet. Always confirm the cluster when fetching accounts.

**Standard SPL Token program (legacy):** `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`

---

## 3. Supported lock types

CBS Token Locker supports three on-chain lock categories, identified by the `token_type` field:

| Lock type | Description |
|---|---|
| **SPL Token locks** | Standard fungible SPL tokens held in a program vault |
| **Standard AMM LP Token locks** | LP tokens from standard AMM pools (same vault mechanics as SPL) |
| **Raydium CLMM Position NFT locks** | Raydium concentrated-liquidity position NFTs, typically minted under Token-2022 |

SPL and LP locks usually use the legacy SPL Token program. CLMM position locks use Token-2022 for the position NFT mint and vault.

---

## 4. What a lock proves

When verification checks pass, a lock demonstrates the following on-chain facts:

1. **Custody** — The locked asset was transferred into a program-controlled vault token account.
2. **Linkage** — The vault address is stored in the lock account and matches the deterministic vault PDA for that lock.
3. **Schedule** — The unlock timestamp (`unlock_timestamp`) is stored on-chain and enforced by the program at withdrawal time.
4. **Ownership** — The locker wallet (`owner`) is stored on-chain; only that wallet may unlock after the unlock time.
5. **Token program** — The SPL Token or Token-2022 program used for the vault is stored in the lock account (`token_program`).
6. **Lifecycle state** — Whether the lock has been unlocked (`is_unlocked`) is stored on-chain.

A verified lock does **not** prove project quality, price stability, pool safety, trading volume, or future token performance. It only proves that the specified asset amount was locked under the stated conditions at the time of verification.

---

## 5. How third parties can verify a lock

Verification should be performed against Solana RPC data for the target cluster (Mainnet or Devnet).

### Step-by-step

1. **Fetch the lock account**  
   Call `getAccountInfo` (or equivalent) for the lock PDA supplied by the user or indexer.

2. **Confirm program ownership**  
   The account owner must be the CBS Token Locker program ID:  
   `DA1sh6XTa13QQ23sLNdcPfCZF5SGMKXXYLxcfAJYcCmU`

3. **Parse lock data**  
   Decode the account data using the CBS `TokenLock` layout (220-byte account; Anchor account discriminator at bytes 0–7). Extract at minimum: `owner`, `mint`, `vault`, `amount`, `unlock_timestamp`, `token_type`, `is_unlocked`, `token_program`, and `lock_seed`.

4. **Confirm lock PDA derivation**  
   Re-derive the lock address from seeds `["lock", owner, mint, lock_seed_le_bytes]` and confirm it matches the supplied lock PDA.

5. **Confirm vault address**  
   Re-derive the vault PDA from seeds `["vault", lock_account]` and confirm it matches the `vault` field stored in the lock account.

6. **Fetch and inspect the vault token account**  
   Using the **token program stored in the lock account** (not assumed), fetch the vault token account and confirm:
   - The vault's mint matches the lock's `mint`
   - The vault's owner/authority is the lock PDA (not the end-user wallet)

7. **Confirm vault balance**  
   For active locks (`is_unlocked == false`), the vault balance must be **greater than or equal to** the locked `amount` stored in the lock account.  
   For unlocked locks (`is_unlocked == true`), the vault balance should be **zero** (tokens returned to the owner).

8. **Confirm active lock state**  
   For a lock that should still be locked:
   - `is_unlocked` must be `false`
   - Current Unix time must be **before** `unlock_timestamp` (time-lock still in effect)

9. **Confirm unlock eligibility (optional display)**  
   If current time is **on or after** `unlock_timestamp` and `is_unlocked` is still `false`, the lock is **unlockable** but not yet withdrawn. The assets remain in the vault until the owner submits an unlock transaction.

### PDA seeds (reference)

| Account | Seeds |
|---|---|
| Lock PDA | `["lock", owner_pubkey, mint_pubkey, lock_seed_u64_le]` |
| Vault PDA | `["vault", lock_pda_pubkey]` |

---

## 6. Token types (`token_type`)

The `token_type` field is a single byte in the lock account:

| Value | Meaning | Integration label |
|---:|---|---|
| `0` | SPL token lock | `spl` |
| `1` | LP token lock | `lp` |
| `2` | CLMM position NFT lock | `clmm` |
| Other | Unknown / unsupported | Treat as `unknown`; do not assume vault semantics |

Indexers should map known values to human-readable labels (for example, **SPL**, **LP**, **CLMM Position**) and reject or flag unknown values until explicitly supported.

---

## 7. Token-2022 support

**Token-2022 program ID:** `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`

Raydium CLMM position NFTs are Token-2022 mints. For CLMM locks:

- The lock account's `mint` is the position NFT mint
- The lock account's `token_program` field stores Token-2022 (not the legacy SPL program)
- The vault is a Token-2022 token account derived for that mint and lock PDA

**Important:** Always use the `token_program` field from the lock account when decoding vault balances. Do not assume `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` for all locks.

SPL and LP locks typically use the legacy SPL Token program, but integrators should still read `token_program` from the lock account rather than inferring from `token_type` alone.

---

## 8. Example verification checklist for indexers

Use this checklist when ingesting or displaying a CBS lock:

- [ ] Cluster is identified (Mainnet vs Devnet)
- [ ] Lock account exists at the given PDA
- [ ] Lock account owner is `DA1sh6XTa13QQ23sLNdcPfCZF5SGMKXXYLxcfAJYcCmU`
- [ ] Account data parses as a valid `TokenLock` (discriminator + layout)
- [ ] Lock PDA matches seeds `["lock", owner, mint, lock_seed]`
- [ ] Vault PDA matches seeds `["vault", lock_pda]`
- [ ] Vault field in lock data equals derived vault PDA
- [ ] Vault token account exists under the lock's `token_program`
- [ ] Vault mint equals lock `mint`
- [ ] Vault authority equals lock PDA
- [ ] If `is_unlocked == false`: vault balance ≥ lock `amount`
- [ ] If `is_unlocked == true`: vault balance == 0
- [ ] If displaying "actively locked": `is_unlocked == false` AND `now < unlock_timestamp`
- [ ] `token_type` is 0, 1, or 2 (or flagged unknown)
- [ ] Amount, owner, unlock time, and project name read from lock account match displayed metadata

---

## 9. Example JSON response (proposed public API)

The endpoint below is a **proposed** convenience API for integrators. It is not required for verification; all checks in Section 5 can be done via RPC alone.

**Proposed endpoint:** `GET /api/v1/verify/lock/{lockPda}?cluster=mainnet`

**Example response (200 OK):**

```json
{
  "cluster": "mainnet",
  "programId": "DA1sh6XTa13QQ23sLNdcPfCZF5SGMKXXYLxcfAJYcCmU",
  "lockAccount": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "verified": true,
  "verification": {
    "status": "verified",
    "reason": "CBS verified on-chain",
    "checks": {
      "programOwnership": true,
      "accountLayout": true,
      "lockPdaDerivation": true,
      "vaultPdaDerivation": true,
      "vaultMintMatch": true,
      "vaultAuthorityMatch": true,
      "vaultBalanceMatch": true,
      "unlockStateConsistent": true
    }
  },
  "lock": {
    "owner": "LockerWallet1111111111111111111111111111111",
    "mint": "Mint1111111111111111111111111111111111111",
    "vault": "Vault1111111111111111111111111111111111111",
    "amount": "1000000000",
    "unlockAt": "2026-12-31T23:59:59.000Z",
    "createdAt": "2026-06-01T12:00:00.000Z",
    "lockSeed": "42",
    "tokenType": "spl",
    "tokenTypeByte": 0,
    "isUnlocked": false,
    "tokenProgram": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    "projectName": "Example Project"
  },
  "display": {
    "status": "active",
    "unlockAvailable": false,
    "tokenTypeLabel": "SPL Token"
  },
  "verifiedAt": "2026-06-15T18:30:00.000Z"
}
```

**Example response (verified: false):**

```json
{
  "cluster": "mainnet",
  "programId": "DA1sh6XTa13QQ23sLNdcPfCZF5SGMKXXYLxcfAJYcCmU",
  "lockAccount": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "verified": false,
  "verification": {
    "status": "failed",
    "reason": "Vault balance is lower than the locked amount.",
    "checks": {
      "programOwnership": true,
      "accountLayout": true,
      "lockPdaDerivation": true,
      "vaultPdaDerivation": true,
      "vaultMintMatch": true,
      "vaultAuthorityMatch": true,
      "vaultBalanceMatch": false,
      "unlockStateConsistent": true
    }
  },
  "verifiedAt": "2026-06-15T18:30:00.000Z"
}
```

Field names and check breakdown may evolve; integrators should treat on-chain RPC verification as the source of truth.

---

## 10. Integration message (reference copy)

Use this short description in listings, docs, or partner integrations:

> **CBS Token Locker is a Solana locker program supporting SPL, LP and Raydium CLMM Position NFT locks.**

Longer variant (optional):

> CBS Token Locker locks SPL tokens, standard AMM LP tokens, and Raydium CLMM position NFTs into program-controlled vaults until a fixed on-chain unlock time. Locks are verifiable by reading the lock PDA, vault token account, and CBS program ID on Solana.

---

## Account layout reference (`TokenLock`)

| Field | Type | Notes |
|---|---|---|
| discriminator | `[u8; 8]` | Anchor account discriminator |
| owner | Pubkey | Original locker wallet |
| mint | Pubkey | Locked token or position NFT mint |
| vault | Pubkey | Program vault token account |
| amount | u64 | Locked amount in base units |
| unlock_timestamp | i64 | Unix timestamp (seconds) |
| created_at | i64 | Unix timestamp (seconds) |
| lock_seed | u64 | Seed for multiple locks per owner/mint |
| token_type | u8 | `0` = SPL, `1` = LP, `2` = CLMM |
| is_unlocked | bool | `1` = unlocked |
| bump | u8 | Lock PDA bump seed |
| vault_bump | u8 | Vault PDA bump seed |
| token_program | Pubkey | SPL Token or Token-2022 program |
| project_name | `[u8; 48]` | UTF-8 project label (null-padded) |

Total account size: **220 bytes**.

---

## Related documentation

- Program overview: [`docs/PROGRAM.md`](../PROGRAM.md)
- Repository: CBS Token Locker (open-source Solana locker)

---

## Version history

| Version | Date | Notes |
|---|---|---|
| v1 | 2026-06 | Initial public verification specification |
