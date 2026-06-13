import type { CreateLockInput, LockRecord } from '../types/lock'
import { CreateLockFlowError, runCreateLockFlow } from '../solana/createLockFlow'
import { mountCreateLockProgressModal } from '../components/createLockProgressModal'
import { validateCreateLockInput } from '../locker'
import type { SolanaWalletProvider } from '../wallet'

export class CreateLockError extends Error {
  readonly debugOutput: CreateLockFlowError['debugOutput'] | null
  readonly failedStep: string | null

  constructor(message: string, debugOutput: CreateLockFlowError['debugOutput'] | null = null) {
    super(message)
    this.name = 'CreateLockError'
    this.debugOutput = debugOutput
    this.failedStep = debugOutput?.failedStep ?? null
  }
}

export async function executeCreateLockWithProgress(
  input: CreateLockInput,
  walletProvider: SolanaWalletProvider,
): Promise<LockRecord> {
  validateCreateLockInput(input)

  const { controller, reporter } = mountCreateLockProgressModal()

  try {
    const lock = await runCreateLockFlow({
      createInput: input,
      walletProvider,
      reporter,
    })

    controller.showSuccess({
      lockAccount: lock.lockAccount,
      vaultAccount: lock.vault,
      signature: lock.createSignature ?? '',
    })

    return lock
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create on-chain lock.'
    const debugOutput = error instanceof CreateLockFlowError ? error.debugOutput : null

    controller.showFailure(message, debugOutput)
    throw new CreateLockError(message, debugOutput)
  }
}
