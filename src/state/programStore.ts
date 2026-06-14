import type { SolanaNetwork } from '../solana/config'
import { isRpcRateLimitError } from '../solana/rpcFetch'
import { checkProgramDeployed, type ProgramDeploymentStatus } from '../solana/programStatus'
import { withRpcCallSource } from './rpcCallTracker'
import { PROGRAM_STATUS_RATE_LIMIT_MESSAGE } from './rpcActivityStore'

type ProgramStatusListener = (status: ProgramDeploymentStatus) => void

let currentStatus: ProgramDeploymentStatus = {
  cluster: 'devnet',
  deployed: false,
  statusKnown: false,
  checkedAt: null,
  loading: true,
  error: null,
}

const listeners = new Set<ProgramStatusListener>()

function notifyListeners(): void {
  for (const listener of listeners) {
    listener(currentStatus)
  }
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
): Promise<ProgramDeploymentStatus> {
  currentStatus = {
    ...currentStatus,
    cluster,
    loading: true,
    error: null,
  }
  notifyListeners()

  try {
    const status = await withRpcCallSource('program-status:check', () => checkProgramDeployed(cluster))
    currentStatus = status
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
  }

  notifyListeners()
  return currentStatus
}
