import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit'

import { getSelectedNetwork } from './cluster'
import { getRpcUrl, type SolanaNetwork } from './config'
import { createThrottledRpcFetch } from './rpcFetch'

type SolanaRpc = ReturnType<typeof createSolanaRpc>

let cachedRpc: SolanaRpc | null = null
let cachedNetwork: SolanaNetwork | null = null
let cachedFetch: typeof fetch | null = null

export function resetRpcCache(): void {
  cachedRpc = null
  cachedNetwork = null
}

function getThrottledFetch(): typeof fetch {
  if (!cachedFetch) {
    cachedFetch = createThrottledRpcFetch()
  }

  return cachedFetch
}

export function getSolanaRpc(network: SolanaNetwork = getSelectedNetwork()): SolanaRpc {
  if (cachedRpc && cachedNetwork === network) {
    return cachedRpc
  }

  cachedRpc = createSolanaRpc(getRpcUrl(network), {
    fetch: getThrottledFetch(),
  } as Parameters<typeof createSolanaRpc>[1])
  cachedNetwork = network
  return cachedRpc
}

export function getSolanaRpcSubscriptions(network: SolanaNetwork = getSelectedNetwork()) {
  const rpcUrl = getRpcUrl(network)
  const websocketUrl = rpcUrl.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:')

  return createSolanaRpcSubscriptions(websocketUrl)
}
