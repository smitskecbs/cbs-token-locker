import { getBase58Encoder } from '@solana/codecs-strings'
import { getWallets } from '@wallet-standard/app'

import {
  getDefaultNetwork,
  getSolanaChainId,
  type SolanaNetwork,
} from './solana/config'
import { getWalletStandardWallets } from './solana/walletStandard'
import {
  createInjectedWalletSerializeWrapper,
  type InjectedWalletSerializeWrapper,
} from './solana/transactionWire'

export type SolanaWalletProvider = {
  connect?: (options?: { onlyIfTrusted?: boolean }) => Promise<{
    publicKey: {
      toString(): string
    }
  }>
  disconnect?: () => Promise<void>
  publicKey?: {
    toString(): string
  }
  signTransaction?: (transaction: unknown) => Promise<unknown>
  signAllTransactions?: (transactions: unknown[]) => Promise<unknown[]>
  signAndSendTransaction?: (
    transaction: unknown,
    options?: unknown,
  ) => Promise<{
    signature: string
  }>
}

export type DetectedWallet = {
  id: string
  name: string
  provider: SolanaWalletProvider
  source: 'injected' | 'wallet-standard'
}

export type WalletConnectionState = {
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  walletId: string | null
  walletName: string | null
  address: string | null
  errorMessage: string | null
}

declare global {
  interface Window {
    phantom?: {
      solana?: SolanaWalletProvider
    }
    solana?: SolanaWalletProvider & {
      isPhantom?: boolean
      isSolflare?: boolean
      isBackpack?: boolean
      isGlow?: boolean
    }
    solflare?: SolanaWalletProvider
    backpack?: {
      solana?: SolanaWalletProvider
    }
    glow?: {
      solana?: SolanaWalletProvider
    } | SolanaWalletProvider
  }
}

const SOLANA_CHAIN_PREFIX = 'solana:'

type WalletStandardWallet = ReturnType<typeof getWalletStandardWallets>[number]

type NetworkResolver = () => SolanaNetwork

let networkResolver: NetworkResolver = getDefaultNetwork

const providerRegistry = new Map<string, DetectedWallet>()

let connectionState: WalletConnectionState = {
  status: 'disconnected',
  walletId: null,
  walletName: null,
  address: null,
  errorMessage: null,
}

const connectionListeners = new Set<(state: WalletConnectionState) => void>()

export function setWalletNetworkResolver(resolver: NetworkResolver): void {
  networkResolver = resolver
}

function walletChainId(): string {
  return getSolanaChainId(networkResolver())
}

function notifyConnectionListeners(): void {
  for (const listener of connectionListeners) {
    listener(connectionState)
  }
}

export function getWalletConnectionState(): WalletConnectionState {
  return { ...connectionState }
}

export function subscribeToWalletConnection(
  listener: (state: WalletConnectionState) => void,
): () => void {
  connectionListeners.add(listener)
  listener(getWalletConnectionState())

  return () => {
    connectionListeners.delete(listener)
  }
}

function hasConnectMethod(provider: SolanaWalletProvider): boolean {
  return typeof provider.connect === 'function'
}

function isLikelySolanaAddress(addressValue: string): boolean {
  const trimmed = addressValue.trim()

  if (!trimmed || trimmed.startsWith('0x')) {
    return false
  }

  return trimmed.length >= 32 && trimmed.length <= 44
}

function isMetaMaskInjectedProvider(provider: unknown): boolean {
  return Boolean((provider as { isMetaMask?: boolean }).isMetaMask)
}

function hasSolanaSigningCapability(provider: SolanaWalletProvider): boolean {
  const normalized = normalizeProvider(provider)

  return (
    typeof normalized.signTransaction === 'function' ||
    typeof provider.signAndSendTransaction === 'function'
  )
}

function hasSolanaPublicKeySupport(provider: SolanaWalletProvider): boolean {
  if (!provider.publicKey) {
    return true
  }

  return isLikelySolanaAddress(provider.publicKey.toString())
}

function isAllowedSolanaWallet(provider: SolanaWalletProvider): boolean {
  if (isMetaMaskInjectedProvider(provider)) {
    return false
  }

  if (!hasConnectMethod(provider)) {
    return false
  }

  if (!hasSolanaPublicKeySupport(provider)) {
    return false
  }

  return hasSolanaSigningCapability(provider)
}

function accountSupportsSolana(account: {
  address: string
  chains?: readonly string[]
}): boolean {
  if (!isLikelySolanaAddress(account.address)) {
    return false
  }

  if (!account.chains || account.chains.length === 0) {
    return true
  }

  return account.chains.some((chain) => chain.startsWith(SOLANA_CHAIN_PREFIX))
}

function walletStandardHasSolanaSigningFeatures(wallet: WalletStandardWallet): boolean {
  return (
    'solana:signTransaction' in wallet.features ||
    'solana:signAndSendTransaction' in wallet.features
  )
}

function isEvmOnlyWalletStandardWallet(wallet: WalletStandardWallet): boolean {
  if (walletStandardHasSolanaSigningFeatures(wallet)) {
    return false
  }

  const featureNames = Object.keys(wallet.features)
  const hasEvmFeatures = featureNames.some((feature) => {
    return feature.startsWith('eip155:') || feature.startsWith('ethereum:')
  })

  if (!hasEvmFeatures) {
    return false
  }

  if (wallet.accounts.length === 0) {
    return true
  }

  return wallet.accounts.every((account) => {
    const addressValue = account.address.trim()

    if (addressValue.startsWith('0x')) {
      return true
    }

    return account.chains?.every((chain) => chain.startsWith('eip155:')) ?? false
  })
}

function isSolanaWalletStandardWallet(wallet: WalletStandardWallet): boolean {
  if (!('standard:connect' in wallet.features)) {
    return false
  }

  if (!walletStandardHasSolanaSigningFeatures(wallet)) {
    return false
  }

  if (isEvmOnlyWalletStandardWallet(wallet)) {
    return false
  }

  if (wallet.accounts.length > 0) {
    const hasSolanaAccount = wallet.accounts.some(accountSupportsSolana)

    if (!hasSolanaAccount && !walletStandardHasSolanaSigningFeatures(wallet)) {
      return false
    }
  }

  return true
}

function walletStandardWalletId(wallet: WalletStandardWallet): string {
  const normalizedName = wallet.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  return `ws-${normalizedName}`
}

function toInjectedWalletTransaction(transaction: unknown): InjectedWalletSerializeWrapper | unknown {
  if (transaction instanceof Uint8Array) {
    return createInjectedWalletSerializeWrapper(transaction)
  }

  const maybeSerialize = transaction as InjectedWalletSerializeWrapper

  if (typeof maybeSerialize.serialize === 'function') {
    return transaction
  }

  return createInjectedWalletSerializeWrapper(transactionToBytes(transaction))
}

function adaptInjectedWalletSigning(provider: SolanaWalletProvider): SolanaWalletProvider {
  const adapted: SolanaWalletProvider = { ...provider }

  if (typeof provider.signTransaction === 'function') {
    adapted.signTransaction = async (transaction) => {
      return provider.signTransaction!(toInjectedWalletTransaction(transaction))
    }
  }

  if (typeof provider.signAllTransactions === 'function') {
    adapted.signAllTransactions = async (transactions) => {
      return provider.signAllTransactions!(
        transactions.map((transaction) => toInjectedWalletTransaction(transaction)),
      )
    }
  }

  if (typeof provider.signAndSendTransaction === 'function') {
    adapted.signAndSendTransaction = async (transaction, options) => {
      return provider.signAndSendTransaction!(
        toInjectedWalletTransaction(transaction),
        options,
      )
    }
  }

  return adapted
}

function normalizeProvider(provider: SolanaWalletProvider): SolanaWalletProvider {
  let normalized = adaptInjectedWalletSigning(provider)

  if (typeof normalized.signTransaction === 'function') {
    return normalized
  }

  if (typeof normalized.signAllTransactions === 'function') {
    return {
      ...normalized,
      signTransaction: async (transaction: unknown) => {
        const signed = await normalized.signAllTransactions!([transaction])
        return signed[0]
      },
    }
  }

  return normalized
}

function transactionToBytes(transaction: unknown): Uint8Array {
  if (transaction instanceof Uint8Array) {
    return transaction
  }

  const maybeSerialize = transaction as {
    serialize?: (options?: unknown) => Uint8Array
  }

  if (typeof maybeSerialize.serialize === 'function') {
    const serialized = maybeSerialize.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    })

    if (serialized instanceof Uint8Array) {
      return serialized
    }
  }

  throw new Error('This wallet does not support the required signing method.')
}

function bytesToTransaction(original: unknown, signedBytes: Uint8Array): unknown {
  if (typeof original === 'object' && original !== null) {
    return Object.assign({}, original, {
      serialize() {
        return signedBytes
      },
    })
  }

  return signedBytes
}

function createWalletStandardProvider(
  wallet: WalletStandardWallet,
): SolanaWalletProvider | null {
  const features = wallet.features as Record<string, unknown>

  const connectFeature = features['standard:connect'] as
    | {
        connect: (input?: { silent?: boolean }) => Promise<{
          accounts: Array<{
            address: string
          }>
        }>
      }
    | undefined

  const signTransactionFeature = features['solana:signTransaction'] as
    | {
        signTransaction: (input: {
          account: {
            address: string
          }
          transaction: Uint8Array
          chain: string
        }) => Promise<
          Array<{
            signedTransaction: Uint8Array
          }>
        >
      }
    | undefined

  const signAndSendFeature = features['solana:signAndSendTransaction'] as
    | {
        signAndSendTransaction: (input: {
          account: {
            address: string
          }
          transaction: Uint8Array
          chain: string
        }) => Promise<
          Array<{
            signature: Uint8Array | string
          }>
        >
      }
    | undefined

  if (!connectFeature || (!signTransactionFeature && !signAndSendFeature)) {
    return null
  }

  let activeAccount: { address: string } | undefined = wallet.accounts[0]

  const provider: SolanaWalletProvider = {
    async connect(options) {
      const result = await connectFeature.connect({
        silent: options?.onlyIfTrusted,
      })

      activeAccount = result.accounts[0] ?? wallet.accounts[0]

      if (!activeAccount) {
        throw new Error('No wallet account returned.')
      }

      return {
        publicKey: {
          toString: () => activeAccount!.address,
        },
      }
    },

    get publicKey() {
      const account = activeAccount ?? wallet.accounts[0]

      if (!account) {
        return undefined
      }

      return {
        toString: () => account.address,
      }
    },

    async signTransaction(transaction) {
      if (!signTransactionFeature) {
        throw new Error('This wallet does not support transaction signing.')
      }

      const account = activeAccount ?? wallet.accounts[0]

      if (!account) {
        throw new Error('No wallet account selected.')
      }

      const signed = await signTransactionFeature.signTransaction({
        account,
        transaction: transactionToBytes(transaction),
        chain: walletChainId(),
      })

      return bytesToTransaction(transaction, signed[0]!.signedTransaction)
    },

    async signAllTransactions(transactions) {
      const signed = []

      for (const transaction of transactions) {
        signed.push(await provider.signTransaction!(transaction))
      }

      return signed
    },

    async signAndSendTransaction(transaction) {
      if (!signAndSendFeature) {
        throw new Error('This wallet does not support sign and send.')
      }

      const account = activeAccount ?? wallet.accounts[0]

      if (!account) {
        throw new Error('No wallet account selected.')
      }

      const result = await signAndSendFeature.signAndSendTransaction({
        account,
        transaction: transactionToBytes(transaction),
        chain: walletChainId(),
      })

      const signature = result[0]!.signature

      return {
        signature:
          typeof signature === 'string'
            ? signature
            : getBase58Encoder().encode(signature),
      }
    },
  }

  return normalizeProvider(provider)
}

function registerWallet(
  wallet: DetectedWallet,
  seenProviders: Set<SolanaWalletProvider>,
): void {
  if (seenProviders.has(wallet.provider)) {
    return
  }

  seenProviders.add(wallet.provider)

  let walletId = wallet.id

  if (providerRegistry.has(walletId)) {
    walletId = `${walletId}-${wallet.source}`
  }

  providerRegistry.set(walletId, {
    ...wallet,
    id: walletId,
  })
}

function getGlowProvider(): SolanaWalletProvider | undefined {
  const glow = window.glow

  if (!glow) {
    return undefined
  }

  if (typeof (glow as { solana?: SolanaWalletProvider }).solana !== 'undefined') {
    return (glow as { solana?: SolanaWalletProvider }).solana
  }

  return glow as SolanaWalletProvider
}

function detectInjectedWallet(
  id: string,
  name: string,
  provider: SolanaWalletProvider | undefined,
): DetectedWallet | null {
  if (!provider || !isAllowedSolanaWallet(provider)) {
    return null
  }

  return {
    id,
    name,
    provider: normalizeProvider(provider),
    source: 'injected',
  }
}

function detectGenericWindowSolanaWallet(): DetectedWallet | null {
  const provider = window.solana

  if (!provider || !isAllowedSolanaWallet(provider)) {
    return null
  }

  if (provider.isPhantom) {
    return detectInjectedWallet('phantom', 'Phantom', provider)
  }

  if (provider.isSolflare) {
    return detectInjectedWallet('solflare', 'Solflare', provider)
  }

  if (provider.isBackpack) {
    return detectInjectedWallet('backpack', 'Backpack', provider)
  }

  if (provider.isGlow) {
    return detectInjectedWallet('glow', 'Glow', provider)
  }

  return detectInjectedWallet('solana', 'Solana Wallet', provider)
}

function detectInjectedWallets(): DetectedWallet[] {
  const wallets: DetectedWallet[] = []

  const candidates: Array<DetectedWallet | null> = [
    detectInjectedWallet('phantom', 'Phantom', window.phantom?.solana),
    detectInjectedWallet('solflare', 'Solflare', window.solflare),
    detectInjectedWallet('backpack', 'Backpack', window.backpack?.solana),
    detectInjectedWallet('glow', 'Glow', getGlowProvider()),
    detectGenericWindowSolanaWallet(),
  ]

  for (const wallet of candidates) {
    if (wallet) {
      wallets.push(wallet)
    }
  }

  return wallets
}

function detectWalletStandardProviders(): DetectedWallet[] {
  const wallets: DetectedWallet[] = []

  for (const wallet of getWalletStandardWallets()) {
    if (!isSolanaWalletStandardWallet(wallet)) {
      continue
    }

    const provider = createWalletStandardProvider(wallet)

    if (!provider || !hasSolanaSigningCapability(provider)) {
      continue
    }

    wallets.push({
      id: walletStandardWalletId(wallet),
      name: wallet.name,
      provider,
      source: 'wallet-standard',
    })
  }

  return wallets
}

export function detectAvailableWallets(): DetectedWallet[] {
  providerRegistry.clear()

  const seenProviders = new Set<SolanaWalletProvider>()

  for (const wallet of detectInjectedWallets()) {
    registerWallet(wallet, seenProviders)
  }

  for (const wallet of detectWalletStandardProviders()) {
    registerWallet(wallet, seenProviders)
  }

  return Array.from(providerRegistry.values()).sort((left, right) => {
    return left.name.localeCompare(right.name)
  })
}

export function getDetectedWallet(walletId: string): DetectedWallet | undefined {
  if (providerRegistry.size === 0) {
    detectAvailableWallets()
  }

  return providerRegistry.get(walletId)
}

export function subscribeToWalletChanges(listener: () => void): () => void {
  const walletsApi = getWallets()

  const unregisterRegister = walletsApi.on('register', listener)
  const unregisterUnregister = walletsApi.on('unregister', listener)

  return () => {
    if (typeof unregisterRegister === 'function') {
      unregisterRegister()
    }

    if (typeof unregisterUnregister === 'function') {
      unregisterUnregister()
    }
  }
}

export async function connectWallet(walletId: string): Promise<WalletConnectionState> {
  const wallet = getDetectedWallet(walletId)

  if (!wallet) {
    connectionState = {
      status: 'error',
      walletId: null,
      walletName: null,
      address: null,
      errorMessage: 'Selected wallet is not available.',
    }
    notifyConnectionListeners()
    return getWalletConnectionState()
  }

  connectionState = {
    status: 'connecting',
    walletId,
    walletName: wallet.name,
    address: null,
    errorMessage: null,
  }
  notifyConnectionListeners()

  try {
    const result = await wallet.provider.connect?.()
    const addressValue = result?.publicKey.toString() ?? wallet.provider.publicKey?.toString()

    if (!addressValue) {
      throw new Error('Wallet did not return a public key.')
    }

    connectionState = {
      status: 'connected',
      walletId,
      walletName: wallet.name,
      address: addressValue,
      errorMessage: null,
    }
  } catch (error) {
    connectionState = {
      status: 'error',
      walletId,
      walletName: wallet.name,
      address: null,
      errorMessage:
        error instanceof Error ? error.message : 'Unable to connect wallet.',
    }
  }

  notifyConnectionListeners()
  return getWalletConnectionState()
}

export async function disconnectWallet(): Promise<WalletConnectionState> {
  const wallet = connectionState.walletId
    ? getDetectedWallet(connectionState.walletId)
    : undefined

  try {
    await wallet?.provider.disconnect?.()
  } catch {
    // Ignore disconnect errors and clear local state.
  }

  connectionState = {
    status: 'disconnected',
    walletId: null,
    walletName: null,
    address: null,
    errorMessage: null,
  }

  notifyConnectionListeners()
  return getWalletConnectionState()
}

export function getConnectedWalletProvider(): SolanaWalletProvider | undefined {
  if (!connectionState.walletId || connectionState.status !== 'connected') {
    return undefined
  }

  return getDetectedWallet(connectionState.walletId)?.provider
}

export function getConnectedWalletInfo(): {
  name: string | null
  source: DetectedWallet['source'] | null
} {
  if (!connectionState.walletId || connectionState.status !== 'connected') {
    return { name: null, source: null }
  }

  const wallet = getDetectedWallet(connectionState.walletId)

  return {
    name: wallet?.name ?? connectionState.walletName,
    source: wallet?.source ?? null,
  }
}
