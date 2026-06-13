import { setWalletNetworkResolver } from '../wallet'

import {
  getDefaultNetwork,
  getRpcConfiguration,
  getRpcEndpointLabel,
  type RpcConfiguration,
  type SolanaNetwork,
} from './config'

const CLUSTER_STORAGE_KEY = 'cbs-locker-cluster-preference'

type ClusterListener = (network: SolanaNetwork) => void

let selectedNetwork: SolanaNetwork = readStoredNetwork()
const listeners = new Set<ClusterListener>()

function readStoredNetwork(): SolanaNetwork {
  try {
    const stored = localStorage.getItem(CLUSTER_STORAGE_KEY)?.trim().toLowerCase()

    if (stored === 'devnet' || stored === 'mainnet') {
      return stored
    }
  } catch {
    // UI preference only.
  }

  return getDefaultNetwork()
}

function notifyListeners(): void {
  for (const listener of listeners) {
    listener(selectedNetwork)
  }
}

setWalletNetworkResolver(() => selectedNetwork)

export function getSelectedNetwork(): SolanaNetwork {
  return selectedNetwork
}

export function getSelectedClusterLabel(): string {
  return selectedNetwork === 'devnet' ? 'Devnet' : 'Mainnet'
}

export function getSelectedRpcLabel(): string {
  return getRpcEndpointLabel(selectedNetwork)
}

export function getSelectedRpcConfiguration(): RpcConfiguration {
  return getRpcConfiguration(selectedNetwork)
}

export function getSelectedRpcUrl(): string {
  return getSelectedRpcConfiguration().url
}

export function getSelectedRpcDisplayUrl(): string {
  return getSelectedRpcConfiguration().displayUrl
}

export function getSelectedRpcSourceLabel(): string {
  return getSelectedRpcConfiguration().sourceLabel
}

export function setSelectedNetwork(network: SolanaNetwork): void {
  if (selectedNetwork === network) {
    return
  }

  selectedNetwork = network

  try {
    localStorage.setItem(CLUSTER_STORAGE_KEY, network)
  } catch {
    // UI preference only.
  }

  setWalletNetworkResolver(() => selectedNetwork)
  notifyListeners()
}

export function subscribeToClusterChanges(listener: ClusterListener): () => void {
  listeners.add(listener)
  listener(selectedNetwork)

  return () => {
    listeners.delete(listener)
  }
}
