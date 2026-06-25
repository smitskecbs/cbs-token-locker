import 'dotenv/config'

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import {
  address,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  devnet,
  type Address,
} from '@solana/kit'
import type { KeyPairSigner } from '@solana/signers'

import {
  getRpcConfiguration,
  getRpcUrl,
  type SolanaNetwork,
} from '../../src/solana/config.ts'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  CBS_LOCKER_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '../../src/solana/programId.ts'

/** Phase 0 proof scripts always target devnet, regardless of app default network. */
export const PHASE0_NETWORK = 'devnet' as const satisfies SolanaNetwork

/** Raydium CLMM program on devnet — used by proof tracks only, not production UI. */
export const RAYDIUM_CLMM_PROGRAM_ID_DEVNET: Address = address(
  'DRayAUgENGQBKVaX8owNhgzkEDyoHTGVEGHVJT1E9pfH',
)

const DEFAULT_KEYPAIR_PATH = join(homedir(), '.config', 'solana', 'id.json')

function createPhase0DevnetRpc() {
  return createSolanaRpc(devnet(getRpcUrl(PHASE0_NETWORK)))
}

function createPhase0DevnetRpcSubscriptions() {
  const rpcUrl = getRpcUrl(PHASE0_NETWORK)
  const websocketUrl = rpcUrl.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:')
  return createSolanaRpcSubscriptions(devnet(websocketUrl))
}

let cachedSigner: KeyPairSigner | null = null
let cachedPhase0Rpc: ReturnType<typeof createPhase0DevnetRpc> | null = null
let cachedPhase0RpcSubscriptions: ReturnType<typeof createPhase0DevnetRpcSubscriptions> | null =
  null

export function assertPhase0DevnetOnly(): void {
  if (PHASE0_NETWORK !== 'devnet') {
    throw new Error('Phase 0 tooling is devnet-only.')
  }
}

export function getPhase0Rpc() {
  assertPhase0DevnetOnly()

  if (!cachedPhase0Rpc) {
    cachedPhase0Rpc = createPhase0DevnetRpc()
  }

  return cachedPhase0Rpc
}

export function getPhase0RpcSubscriptions() {
  assertPhase0DevnetOnly()

  if (!cachedPhase0RpcSubscriptions) {
    cachedPhase0RpcSubscriptions = createPhase0DevnetRpcSubscriptions()
  }

  return cachedPhase0RpcSubscriptions
}

export function getPhase0RpcUrl(): string {
  return getRpcUrl(PHASE0_NETWORK)
}

export function getPhase0RpcConfiguration() {
  return getRpcConfiguration(PHASE0_NETWORK)
}

function resolveKeypairPath(): string {
  const fromEnv = process.env.PHASE0_KEYPAIR?.trim()
  return fromEnv || DEFAULT_KEYPAIR_PATH
}

export async function loadPhase0Signer(): Promise<KeyPairSigner> {
  if (cachedSigner) {
    return cachedSigner
  }

  assertPhase0DevnetOnly()

  const keypairPath = resolveKeypairPath()
  const raw = readFileSync(keypairPath, 'utf8')
  const bytes = new Uint8Array(JSON.parse(raw) as number[])

  if (bytes.length !== 64) {
    throw new Error(
      `Phase 0 keypair at ${keypairPath} must be a 64-byte Solana keypair JSON file.`,
    )
  }

  cachedSigner = await createKeyPairSignerFromBytes(bytes)
  return cachedSigner
}

export {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  CBS_LOCKER_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
}
