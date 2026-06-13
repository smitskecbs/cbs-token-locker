export type SolanaNetwork = 'devnet' | 'mainnet'

export type RpcSource = 'custom' | 'helius-api-key' | 'helius' | 'public'

export type RpcConfiguration = {
  network: SolanaNetwork
  url: string
  displayUrl: string
  source: RpcSource
  sourceLabel: string
  envVar: string | null
  heliusApiKeyLoaded: boolean
  viteSolanaRpcDevnetLoaded: boolean
  viteHeliusDevnetRpcLoaded: boolean
  viteSolanaRpcMainnetLoaded: boolean
  viteHeliusMainnetRpcLoaded: boolean
}

const HELIUS_DEVNET_RPC_BASE = 'https://devnet.helius-rpc.com/'

function readEnv(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env[key]?.trim()) {
    return process.env[key]!.trim()
  }

  if (typeof import.meta !== 'undefined' && import.meta.env?.[key]?.trim()) {
    return import.meta.env[key]!.trim()
  }

  return undefined
}

export function getDefaultNetwork(): SolanaNetwork {
  const configured = readEnv('VITE_SOLANA_NETWORK')?.toLowerCase()

  if (configured === 'mainnet' || configured === 'devnet') {
    return configured
  }

  return 'devnet'
}

export function buildHeliusDevnetRpcUrl(apiKey: string): string {
  return `${HELIUS_DEVNET_RPC_BASE}?api-key=${encodeURIComponent(apiKey)}`
}

export function redactRpcUrl(url: string): string {
  return url.replace(/([?&]api-key=)[^&]+/i, '$1***')
}

function rpcSourceLabel(source: RpcSource, network: SolanaNetwork): string {
  if (source === 'helius-api-key') {
    return 'Helius API Key'
  }

  if (source === 'public') {
    return network === 'devnet' ? 'Public Devnet RPC' : 'Public Mainnet RPC'
  }

  if (source === 'helius') {
    return 'Helius RPC'
  }

  return 'Custom RPC'
}

function buildRpcConfiguration(
  network: SolanaNetwork,
  url: string,
  source: RpcSource,
  envVar: string | null,
  envFlags: {
    heliusApiKeyLoaded: boolean
    viteSolanaRpcDevnetLoaded: boolean
    viteHeliusDevnetRpcLoaded: boolean
    viteSolanaRpcMainnetLoaded: boolean
    viteHeliusMainnetRpcLoaded: boolean
  },
): RpcConfiguration {
  return {
    network,
    url,
    displayUrl: redactRpcUrl(url),
    source,
    sourceLabel: rpcSourceLabel(source, network),
    envVar,
    ...envFlags,
  }
}

export function getRpcConfiguration(network: SolanaNetwork = getDefaultNetwork()): RpcConfiguration {
  const viteSolanaRpcDevnet = readEnv('VITE_SOLANA_RPC_DEVNET')
  const heliusDevnetApiKey = readEnv('HELIUS_DEVNET_API_KEY')
  const viteHeliusDevnet = readEnv('VITE_HELIUS_DEVNET_RPC')
  const viteSolanaRpcMainnet = readEnv('VITE_SOLANA_RPC_MAINNET')
  const viteHeliusMainnet = readEnv('VITE_HELIUS_MAINNET_RPC')

  const envFlags = {
    heliusApiKeyLoaded: Boolean(heliusDevnetApiKey),
    viteSolanaRpcDevnetLoaded: Boolean(viteSolanaRpcDevnet),
    viteHeliusDevnetRpcLoaded: Boolean(viteHeliusDevnet),
    viteSolanaRpcMainnetLoaded: Boolean(viteSolanaRpcMainnet),
    viteHeliusMainnetRpcLoaded: Boolean(viteHeliusMainnet),
  }

  if (network === 'devnet') {
    if (viteSolanaRpcDevnet) {
      return buildRpcConfiguration(
        network,
        viteSolanaRpcDevnet,
        'custom',
        'VITE_SOLANA_RPC_DEVNET',
        envFlags,
      )
    }

    if (heliusDevnetApiKey) {
      return buildRpcConfiguration(
        network,
        buildHeliusDevnetRpcUrl(heliusDevnetApiKey),
        'helius-api-key',
        'HELIUS_DEVNET_API_KEY',
        envFlags,
      )
    }

    if (viteHeliusDevnet) {
      return buildRpcConfiguration(
        network,
        viteHeliusDevnet,
        'helius',
        'VITE_HELIUS_DEVNET_RPC',
        envFlags,
      )
    }

    return buildRpcConfiguration(
      network,
      'https://api.devnet.solana.com',
      'public',
      null,
      envFlags,
    )
  }

  if (viteSolanaRpcMainnet) {
    return buildRpcConfiguration(
      network,
      viteSolanaRpcMainnet,
      'custom',
      'VITE_SOLANA_RPC_MAINNET',
      envFlags,
    )
  }

  if (viteHeliusMainnet) {
    return buildRpcConfiguration(
      network,
      viteHeliusMainnet,
      'helius',
      'VITE_HELIUS_MAINNET_RPC',
      envFlags,
    )
  }

  return buildRpcConfiguration(
    network,
    'https://api.mainnet-beta.solana.com',
    'public',
    null,
    envFlags,
  )
}

export function logRpcConfiguration(network: SolanaNetwork = getDefaultNetwork()): void {
  logRpcConfigurationWithPrefix('[CBS Locker]', network)
}

export function logApiRpcConfiguration(network: SolanaNetwork = getDefaultNetwork()): void {
  logRpcConfigurationWithPrefix('[CBS Locker API]', network)
}

function logRpcConfigurationWithPrefix(prefix: string, network: SolanaNetwork): void {
  const config = getRpcConfiguration(network)
  const usingPublicDevnetFallback =
    config.network === 'devnet' &&
    config.source === 'public' &&
    !config.viteSolanaRpcDevnetLoaded &&
    !config.heliusApiKeyLoaded &&
    !config.viteHeliusDevnetRpcLoaded

  console.info(`${prefix} RPC configuration`)
  console.info(`Source: ${config.sourceLabel}`)
  console.info(`URL: ${config.displayUrl}`)
  console.info(`API Key Loaded: ${config.heliusApiKeyLoaded ? 'Yes' : 'No'}`)
  console.info(`${prefix} RPC configuration details`, {
    network: config.network,
    envVar: config.envVar,
    viteSolanaRpcDevnetLoaded: config.viteSolanaRpcDevnetLoaded,
    viteHeliusDevnetRpcLoaded: config.viteHeliusDevnetRpcLoaded,
    usingPublicDevnetFallback,
  })
}

export function getRpcUrl(network: SolanaNetwork = getDefaultNetwork()): string {
  return getRpcConfiguration(network).url
}

export function getRpcDisplayUrl(network: SolanaNetwork = getDefaultNetwork()): string {
  return getRpcConfiguration(network).displayUrl
}

export function getRpcEndpointLabel(network: SolanaNetwork = getDefaultNetwork()): string {
  return getRpcConfiguration(network).sourceLabel
}

export function getSolanaChainId(network: SolanaNetwork = getDefaultNetwork()): string {
  return network === 'mainnet' ? 'solana:mainnet' : 'solana:devnet'
}

export function getExplorerClusterParam(network: SolanaNetwork): string {
  return network === 'devnet' ? '?cluster=devnet' : ''
}

export function getOrbAccountUrl(account: string, network: SolanaNetwork): string {
  const base = `https://orb.helius.dev/account/${encodeURIComponent(account)}`

  return network === 'devnet' ? `${base}?cluster=devnet` : base
}
