export type SolanaNetwork = 'devnet' | 'mainnet'

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
