import type { SolanaNetwork } from '../solana/config'
import { DEFAULT_SOLANA_NETWORK } from '../solana/config'
import { isRpcRateLimitError } from '../solana/rpcFetch'
import { checkProgramDeployed, type ProgramDeploymentStatus } from '../solana/programStatus'
import { withRpcCallSource } from './rpcCallTracker'
import { PROGRAM_STATUS_RATE_LIMIT_MESSAGE } from './rpcActivityStore'

const PROGRAM_STATUS_CACHE_MS = 5 * 60 * 1000

type ProgramStatusListener = (status: ProgramDeploymentStatus) => void

let currentStatus: ProgramDeploymentStatus = {
  cluster: DEFAULT_SOLANA_NETWORK,
  deployed: false,
  statusKnown: false,
  checkedAt: null,
  loading: true,
  error: null,
}

const statusCache = new Map<SolanaNetwork, ProgramDeploymentStatus>()
const listeners = new Set<ProgramStatusListener>()

function notifyListeners(): void {
  for (const listener of listeners) {
    listener(currentStatus)
  }
}

function isCacheFresh(status: ProgramDeploymentStatus): boolean {
  if (!status.checkedAt || !status.statusKnown) {
    return false
  }

  return Date.now() - new Date(status.checkedAt).getTime() < PROGRAM_STATUS_CACHE_MS
}

export function getProgramStatus(): ProgramDeploymentStatus {
  return currentStatus
}

export function subscribeToProgramStatus(listener: ProgramStatusListener): () => void {
  listeners.add(listener)
  listener(currentStatus)

  return () => {
    listeners.delete(listener)
  }
}

export async function refreshProgramStatus(
  cluster: SolanaNetwork = currentStatus.cluster,
  options?: { force?: boolean },
): Promise<ProgramDeploymentStatus> {
  const cached = statusCache.get(cluster)

  if (!options?.force && cached && isCacheFresh(cached)) {
    currentStatus = cached
    notifyListeners()
    return cached
  }

  currentStatus = {
    cluster,
    deployed: false,
    statusKnown: false,
    checkedAt: null,
    loading: true,
    error: null,
  }
  notifyListeners()

  try {
    const status = await withRpcCallSource('program-status:check', () => checkProgramDeployed(cluster))
    currentStatus = status
    statusCache.set(cluster, status)
  } catch (error) {
    if (isRpcRateLimitError(error)) {
      currentStatus = {
        ...currentStatus,
        cluster,
        loading: false,
        statusKnown: false,
        error: PROGRAM_STATUS_RATE_LIMIT_MESSAGE,
        checkedAt: new Date().toISOString(),
      }
    } else {
      currentStatus = {
        cluster,
        deployed: false,
        statusKnown: false,
        checkedAt: new Date().toISOString(),
        loading: false,
        error: error instanceof Error ? error.message : 'Unable to check program status.',
      }
    }

    statusCache.set(cluster, currentStatus)
  }

  notifyListeners()
  return currentStatus
}
