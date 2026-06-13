# CBS Token Locker — Devnet Testing

This guide walks through local end-to-end testing on Solana devnet.

## Prerequisites

- Node.js 20+
- npm
- Solana CLI
- Anchor 0.31.1
- A browser wallet (Phantom, Solflare, Backpack, etc.)

## 1. Install dependencies

```bash
npm install
```

## 2. Start the frontend and API

Terminal 1:

```bash
npm run dev:api
```

Terminal 2:

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Public API: `http://localhost:8787`

## 3. Build and deploy the program to devnet

```bash
anchor build
anchor deploy --provider.cluster devnet
```

After deployment, confirm the program ID matches across:

- `Anchor.toml`
- `programs/cbs-token-locker/src/lib.rs`
- `src/solana/programId.ts`

Current devnet program ID:

`DA1sh6XTa13QQ23sLNdcPfCZF5SGMKXXYLxcfAJYcCmU`

## 4. Configure the wallet and cluster

1. Open `http://localhost:5173`
2. Set the cluster selector to **Devnet**
3. Confirm the app reports: **CBS Locker Program is deployed on Devnet**
4. Connect a wallet that supports devnet

If the program is not deployed, the app shows:

> CBS Locker Program is not deployed on Devnet yet.

The create lock button stays disabled until deployment is detected.

## 5. Fund devnet SOL

```bash
solana config set --url devnet
solana airdrop 2
```

## 6. Create or use a devnet SPL token

Use your preferred devnet token tooling to:

1. Create a mint
2. Mint tokens to your wallet associated token account

You need enough tokens in your wallet to cover the lock amount.

## 7. Create a test lock

1. Connect wallet
2. Enter project name, mint address, amount, and future unlock date
3. Acknowledge the safety notice
4. Click **Preview Lock**
5. Click **Create On-chain Lock**
6. Approve the wallet transaction

If something fails, the app should report a specific message such as:

- Program not deployed
- Invalid mint address
- Token account not found
- Insufficient token balance
- Transaction rejected by wallet
- Transaction simulation failed
- RPC error

## 8. Verify the public lock page

Open:

```text
http://localhost:5173/lock/{lockAccount}
```

The page must show **CBS verified on-chain** only if on-chain verification passes.

If verification fails, the page shows:

> This lock could not be verified on-chain.

No verified badge is shown in that case.

## Development debug panel

When running `npm run dev`, a debug panel appears at the bottom of the home page with:

- Selected cluster
- RPC endpoint type (no secret keys)
- Program ID
- Wallet address
- Program deployed: yes/no
- Last transaction signature
- Last error

## Final checklist

- [ ] Frontend runs at `http://localhost:5173`
- [ ] API runs at `http://localhost:8787`
- [ ] Wallet connects on devnet
- [ ] Program status is detected on app load
- [ ] Program deployed on devnet
- [ ] Devnet SPL token created and funded to wallet
- [ ] Lock created successfully
- [ ] Lock page verifies on-chain
- [ ] Unlock blocked before unlock time
- [ ] Unlock works after unlock time

## Troubleshooting

### `anchor build` fails with `edition2024` or `block-buffer v0.12.1`

Solana CLI 2.3.x (Anchor 0.31.1) uses platform-tools **Cargo 1.84.0**, which cannot parse crates that require Rust **edition 2024**. Recent releases of transitive dependencies (for example `blake3 ≥1.8.3`, `constant_time_eq ≥0.4.2`, `toml_parser ≥1.1.0`, `indexmap ≥2.13.0`) can pull in incompatible manifests.

This project pins a BPF-compatible dependency set in:

- `Cargo.toml` (workspace dependency versions)
- `programs/cbs-token-locker/Cargo.toml` (direct workspace pins)
- `Cargo.lock` (committed lockfile — required)

If `anchor build` fails after a fresh `cargo update`, regenerate compatible versions from the repo root:

```bash
cargo update -p blake3 --precise 1.8.2
cargo update -p constant_time_eq --precise 0.3.1
cargo update -p proc-macro-crate@3.5.0 --precise 3.2.0
cargo update -p indexmap --precise 2.11.4
cargo update -p unicode-segmentation --precise 1.12.0
```

Verify the problematic crate is gone:

```bash
cargo tree -i block-buffer@0.12.1
```

Expected: no match (only `block-buffer@0.9.0` and `block-buffer@0.10.4` remain).

Then rebuild:

```bash
anchor build
```

### `idl-build` feature is missing

If Anchor reports a missing `idl-build` feature, ensure `programs/cbs-token-locker/Cargo.toml` includes:

```toml
idl-build = ["anchor-lang/idl-build", "anchor-spl/idl-build"]
```

This is required for IDL generation only; it does not change on-chain program behavior.

### `rustc 1.84.1-dev is not supported` for a dependency

Some crates now require rustc 1.85+. Pin the dependency to the last version that supports Cargo 1.84, commit `Cargo.lock`, and rebuild. This project pins `unicode-segmentation = 1.12.0` for that reason.

## Notes

- Lock proof always comes from Solana RPC and on-chain verification.
- `localStorage` is only used for cluster UI preference, not lock proof.
- DEX recognition is planned. The tool does not claim DEX approval.
- Always commit `Cargo.lock` for the Anchor workspace so CI and local BPF builds resolve the same dependency versions.
