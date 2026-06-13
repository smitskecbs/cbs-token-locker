import type { LockRecord } from '../types/lock'
import { UnlockFlowError } from '../solana/unlockFlow'
import {
  mountUnlockProgressModal,
} from '../components/unlockProgressModal'
import { runUnlockFlow } from '../solana/unlockFlow'
import {
  getConnectedWalletProvider,
  getWalletConnectionState,
} from '../wallet'
import { dispatchLockUnlocked } from './unlockEvents'

export class UnlockLockError extends Error {
  readonly debugOutput: UnlockFlowError['debugOutput'] | null
  readonly failedStep: string | null

  constructor(message: string, debugOutput: UnlockFlowError['debugOutput'] | null = null) {
    super(message)
    this.name = 'UnlockLockError'
    this.debugOutput = debugOutput
    this.failedStep = debugOutput?.failedStep ?? null
  }
}

export async function executeUnlockLock(lock: LockRecord): Promise<LockRecord> {
  return executeUnlockLockWithProgress(lock)
}

export async function executeUnlockLockWithProgress(lock: LockRecord): Promise<LockRecord> {
  const walletProvider = getConnectedWalletProvider()
  const walletState = getWalletConnectionState()

  if (!walletProvider || walletState.status !== 'connected' || !walletState.address) {
    throw new UnlockLockError('Connect your wallet before unlocking tokens.')
  }

  if (walletState.address !== lock.owner) {
    throw new UnlockLockError('Only the original locker wallet can unlock this lock.')
  }

  const { controller, reporter } = mountUnlockProgressModal()

  try {
    const updatedLock = await runUnlockFlow({
      lock,
      walletProvider,
      walletAddress: walletState.address,
      reporter,
    })

    controller.showSuccess()
    dispatchLockUnlocked(updatedLock)

    return updatedLock
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to unlock tokens.'
    const debugOutput = error instanceof UnlockFlowError ? error.debugOutput : null

    controller.showFailure(message, debugOutput)
    throw new UnlockLockError(message, debugOutput)
  }
}
