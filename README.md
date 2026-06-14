# CBS Token Locker

Official CBS tool for verifiable on-chain SPL and LP token locks on Solana.

CBS Token Locker lets project teams lock tokens on Solana with transparent, publicly verifiable lock accounts. Lock state is read directly from the blockchain — not from browser storage or a private database.

## What It Does

### Solana token locking

- Lock SPL or LP tokens into program-controlled vault accounts
- Set a future unlock timestamp and project metadata on-chain
- Each lock uses deterministic PDAs derived from owner, mint, and lock seed

### On-chain verification

- Lock accounts are fetched and validated through Solana RPC
- The app verifies lock PDAs, vault balances, owners, and transaction signatures after create/unlock
- Public lock pages at `/lock/{lockAccount}` expose verifiable on-chain state

### Create Lock

1. Connect a wallet and preview lock details locally
2. Submit a real `create_lock` transaction through your wallet
3. A step-by-step progress modal tracks wallet approval, RPC submission, confirmation, and lock account verification
4. On success, view the lock account, vault account, and transaction signature

### Unlock

1. Open a lock you own after the unlock timestamp
2. Unlock runs RPC simulation, wallet signing, confirmation, and token-return verification
3. A progress modal shows each step with clear success or failure states

## Architecture

- **Frontend:** TypeScript + Vite + Solana Kit + Wallet Standard
- **Program:** Anchor Rust program in `programs/cbs-token-locker`
- **Public API:** Vercel serverless functions in `api/v1/` (local dev: `scripts/dev-api-server.ts`)
- **Proof source:** Solana RPC only. No `localStorage` lock records.

## Program ID

`DA1sh6XTa13QQ23sLNdcPfCZF5SGMKXXYLxcfAJYcCmU` (devnet deployment)

Mainnet deployment is **not active** until the program is deployed on Mainnet and verified in the app.

See [docs/PROGRAM.md](docs/PROGRAM.md) for account layout, PDA seeds, and deployment notes.

## Devnet setup

See [docs/DEVNET_TESTING.md](docs/DEVNET_TESTING.md) for the full local devnet testing flow and checklist.

Quick start:

```bash
npm install
npm run dev:api
npm run dev
```

- Frontend: `http://localhost:5173`
- Public API: `http://localhost:8787`

Set the cluster selector to **Devnet**, confirm the CBS Locker Program is deployed, then create and unlock locks with a funded devnet wallet.

## Mainnet setup

Mainnet is supported in the UI and API, but the CBS Locker Program is **not deployed on Mainnet yet**.

Before using Mainnet:

1. Deploy the Anchor program to Mainnet (see `docs/PROGRAM.md`).
2. Configure Mainnet RPC credentials in `.env` (see below).
3. Set the in-app network selector to **Mainnet**.
4. Confirm the app reports program status for Mainnet (not Devnet).

When Mainnet is selected but the program is not deployed, the app shows:

> CBS Locker Program is not deployed on Mainnet yet.

## Phantom wallet support

CBS Token Locker supports injected wallets (including Phantom) and Wallet Standard–compatible wallets.

- **Phantom (injected):** uses `signTransaction` followed by RPC `sendTransaction`
- **Wallet Standard wallets:** may use `signAndSendTransaction` when available
- Connect, disconnect, and transaction approval flows are handled in-app

Use a wallet funded on devnet for testing. Switch Phantom to Devnet before creating or unlocking locks.

## Local RPC configuration

Create a `.env` file in the project root (copy from `.env.example`):

```bash
HELIUS_DEVNET_API_KEY=PASTE_KEY_HERE
HELIUS_MAINNET_API_KEY=PASTE_KEY_HERE
VITE_SOLANA_RPC_DEVNET=
VITE_SOLANA_RPC_MAINNET=
```

Optional overrides:

- `VITE_HELIUS_DEVNET_RPC` — full Helius Devnet RPC URL
- `VITE_HELIUS_MAINNET_RPC` — full Helius Mainnet RPC URL
- `VITE_SOLANA_NETWORK` — default network when no cluster is stored (`devnet` or `mainnet`)

Restart both the API and frontend after changing env values:

```bash
npm run dev:api
npm run dev
```

### Devnet RPC priority

1. `VITE_SOLANA_RPC_DEVNET` — full custom RPC URL
2. `HELIUS_DEVNET_API_KEY` — builds `https://devnet.helius-rpc.com/?api-key=...`
3. `VITE_HELIUS_DEVNET_RPC` — full Helius RPC URL
4. Public devnet RPC fallback (`https://api.devnet.solana.com`)

### Mainnet RPC priority

1. `VITE_SOLANA_RPC_MAINNET` — full custom RPC URL
2. `HELIUS_MAINNET_API_KEY` — builds `https://mainnet.helius-rpc.com/?api-key=...`
3. `VITE_HELIUS_MAINNET_RPC` — full Helius RPC URL
4. Public mainnet RPC fallback (`https://api.mainnet-beta.solana.com`)

**Never commit `.env`.** Only `.env.example` is tracked in git.

## Public API

All API endpoints accept a `cluster` query parameter: `cluster=devnet` or `cluster=mainnet`.

- If `cluster` is omitted, the API defaults to **devnet**.
- Invalid cluster values return HTTP 400.
- The frontend always sends the selected network as `cluster`.

| Endpoint | Description |
|---|---|
| `GET /api/v1/program?cluster=` | Program metadata for public verification |
| `GET /api/v1/locks/:lockAccount?cluster=` | Read one on-chain lock |
| `GET /api/v1/locks?owner=&cluster=` | List locks for a wallet |
| `GET /api/v1/locks?q=&field=&cluster=` | Search on-chain locks |

## Vercel deployment (Devnet)

The frontend builds with Vite (`dist/`) and the Lock API runs as Vercel serverless functions at `/api/v1/*`. SPA routes (`/lock/...`, `/locks`) rewrite to `index.html`.

### Required environment variables

| Variable | Scope | Purpose |
|---|---|---|
| `VITE_SOLANA_NETWORK` | Build | Default network (`devnet`) |
| `VITE_SOLANA_RPC_DEVNET` | Build | Browser RPC for create/unlock on Devnet |
| `HELIUS_DEVNET_API_KEY` | Runtime (API) | Helius RPC for serverless Lock API |

Set `VITE_LOCK_API_BASE=/api/v1` only if the API is hosted on a different origin.

### Deploy steps

1. Push the repo to GitHub and import the project in [Vercel](https://vercel.com/new).
2. Framework preset: **Vite** (or Other — `vercel.json` sets build/output).
3. Add the three required env vars above for **Production** (and Preview if desired).
4. Deploy. Vercel runs `npm run build` and serves `dist/` plus serverless routes in `api/v1/`.
5. Open the deployment URL, confirm **Devnet** is selected, and the program status shows deployed.
6. Switch to **Mainnet** — status should read *not deployed* and Create Lock stays disabled.

Mainnet program deployment is **not** part of this setup. Do not add Mainnet RPC keys until the program is deployed on Mainnet.

## User flow

1. **Preview mode** — review lock details locally before submitting on-chain
2. **Create on-chain lock** — wallet submits `create_lock` to the CBS program
3. **Public explorer** — `/lock/{lockAccount}` verifies state from Solana
4. **Unlock** — owner wallet returns tokens after the unlock time

## Wording policy

Use:

- Designed for public verification
- On-chain lock
- CBS verified on-chain
- DEX recognition planned

Avoid:

- DEX approved
- Officially recognized
- Guaranteed safe
- Rug-proof

## Security notes for contributors

- Do not commit `.env`, RPC API keys, private keys, or wallet keypair files
- `target/` (Anchor/Rust build output) and `dist/` (frontend build output) are gitignored
- Rotate any API key that was ever stored in a local `.env` before making the repository public
