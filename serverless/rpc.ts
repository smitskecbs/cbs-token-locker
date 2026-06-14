import { createSolanaRpc } from '@solana/kit'

import type { SolanaNetwork } from './cluster.js'
import { getRpcUrl } from './rpcConfig.js'

type SolanaRpc = ReturnType<typeof createSolanaRpc>

const cache = new Map<SolanaNetwork, SolanaRpc>()

export function getSolanaRpc(network: SolanaNetwork = 'devnet'): SolanaRpc {
  const cached = cache.get(network)

  if (cached) {
    return cached
  }

  const rpc = createSolanaRpc(getRpcUrl(network))
  cache.set(network, rpc)
  return rpc
}
