import type { CreateLockInput, LockRecord } from '../types/lock'
import type { SplitLockBatchResult, SplitLockTrancheResult } from '../types/splitLock'
import { validateCreateLockInput } from '../locker'
import { CreateLockFlowError, runCreateLockFlow } from '../solana/createLockFlow'
import type { SolanaWalletProvider } from '../wallet'
import {
  attachSplitLockProgressLinkHandlers,
  mountSplitLockProgressModal,
  type SplitLockProgressController,
} from '../components/splitLockProgressModal'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export async function executeSplitLocks(
  inputs: CreateLockInput[],
  walletProvider: SolanaWalletProvider,
  trancheMeta: Array<{ amount: string; unlockAt: string }>,
): Promise<SplitLockBatchResult> {
  const results: SplitLockTrancheResult[] = inputs.map((_, index) => ({
    index: index + 1,
    status: 'pending',
  }))

  const { modalRoot, controller } = mountSplitLockProgressModal(
    inputs.length,
    trancheMeta,
    results,
  )

  attachSplitLockProgressLinkHandlers(modalRoot)

  try {
    return await runSplitLockBatch(inputs, walletProvider, controller, results)
  } finally {
    // Modal stays open for user to read results; they close manually.
  }
}

async function runSplitLockBatch(
  inputs: CreateLockInput[],
  walletProvider: SolanaWalletProvider,
  controller: SplitLockProgressController,
  results: SplitLockTrancheResult[],
): Promise<SplitLockBatchResult> {
  const completed: LockRecord[] = []

  for (let index = 0; index < inputs.length; index += 1) {
    const input = inputs[index]
    controller.setActiveTranche(index + 1, inputs.length)
    results[index] = { index: index + 1, status: 'active' }
    controller.updateResults(results)

    try {
      validateCreateLockInput(input)

      const lock = await runCreateLockFlow({
        createInput: input,
        walletProvider,
      })

      completed.push(lock)
      results[index] = {
        index: index + 1,
        status: 'success',
        lockAccount: lock.lockAccount,
        signature: lock.createSignature,
      }
      controller.updateResults(results)

      if (index < inputs.length - 1) {
        await sleep(200)
      }
    } catch (error) {
      const message =
        error instanceof CreateLockFlowError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Lock creation failed.'

      results[index] = {
        index: index + 1,
        status: 'failed',
        error: message,
      }

      for (let skipped = index + 1; skipped < inputs.length; skipped += 1) {
        results[skipped] = {
          index: skipped + 1,
          status: 'skipped',
        }
      }

      controller.updateResults(results)
      controller.showPartialFailure({
        completedCount: completed.length,
        totalCount: inputs.length,
        failedIndex: index + 1,
        message,
        results,
      })

      return {
        completed,
        results,
        failedAt: index + 1,
        errorMessage: message,
      }
    }
  }

  controller.showSuccess(completed)

  return {
    completed,
    results,
    failedAt: null,
    errorMessage: null,
  }
}
