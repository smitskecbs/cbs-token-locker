import type { SolanaNetwork } from './cluster.js'

const HELIUS_DEVNET_RPC_BASE = 'https://devnet.helius-rpc.com/'
const HELIUS_MAINNET_RPC_BASE = 'https://mainnet.helius-rpc.com/'

function readEnv(key: string): string | undefined {
  const value = process.env[key]?.trim()
  return value || undefined
}

function buildHeliusDevnetRpcUrl(apiKey: string): string {
  return `${HELIUS_DEVNET_RPC_BASE}?api-key=${encodeURIComponent(apiKey)}`
}

function buildHeliusMainnetRpcUrl(apiKey: string): string {
  return `${HELIUS_MAINNET_RPC_BASE}?api-key=${encodeURIComponent(apiKey)}`
}

export function getRpcUrl(network: SolanaNetwork = 'devnet'): string {
  if (network === 'devnet') {
    const custom = readEnv('VITE_SOLANA_RPC_DEVNET')
    if (custom) {
      return custom
    }

    const heliusKey = readEnv('HELIUS_DEVNET_API_KEY')
    if (heliusKey) {
      return buildHeliusDevnetRpcUrl(heliusKey)
    }

    const heliusRpc = readEnv('VITE_HELIUS_DEVNET_RPC')
    if (heliusRpc) {
      return heliusRpc
    }

    return 'https://api.devnet.solana.com'
  }

  const customMainnet = readEnv('VITE_SOLANA_RPC_MAINNET')
  if (customMainnet) {
    return customMainnet
  }

  const heliusMainnetKey = readEnv('HELIUS_MAINNET_API_KEY')
  if (heliusMainnetKey) {
    return buildHeliusMainnetRpcUrl(heliusMainnetKey)
  }

  const heliusMainnetRpc = readEnv('VITE_HELIUS_MAINNET_RPC')
  if (heliusMainnetRpc) {
    return heliusMainnetRpc
  }

  return 'https://api.mainnet-beta.solana.com'
}

export function logApiRequestCluster(cluster: SolanaNetwork, path: string): void {
  console.info('[CBS Locker API Request]', {
    cluster,
    path,
    rpcUrl: getRpcUrl(cluster).replace(/([?&]api-key=)[^&]+/i, '$1***'),
  })
}
