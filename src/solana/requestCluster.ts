import type { SolanaNetwork } from './config'
import { DEFAULT_SOLANA_NETWORK } from './config'

export function parseRequestCluster(value: string | null | undefined): SolanaNetwork | null {
  const normalized = value?.trim().toLowerCase()

  if (!normalized) {
    return null
  }

  if (normalized === 'devnet' || normalized === 'mainnet') {
    return normalized
  }

  return null
}

export function parseRequestClusterOrDefault(value: string | null | undefined): SolanaNetwork {
  return parseRequestCluster(value) ?? DEFAULT_SOLANA_NETWORK
}
