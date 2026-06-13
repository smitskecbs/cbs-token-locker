import { assertIsSignature, type Address } from '@solana/kit'

import type { LockRecord } from '../types/lock'
import { safeJsonStringify } from '../utils/safeSerialize'
import {
  inspectLockAccountAtPda,
  isLockAccountResolvable,
  lockRecordFromDiagnostics,
  type LockFetchDiagnostics,
} from './lockDiagnostics'
import { getSolanaRpc } from './rpc'

const CONFIRMATION_TIMEOUT_MS = 30_000
const CONFIRMATION_POLL_MS = 1_000
const LOCK_LOOKUP_BACKOFF_MS = [1_000, 2_000, 4_000, 8_000] as const

export type TransactionConfirmationResult = {
  status: 'confirmed' | 'finalized' | 'processed' | 'unknown'
  slot: string | null
  err: unknown | null
}

export type VerifyCreatedLockResult = {
  lock: LockRecord | null
  diagnostics: LockFetchDiagnostics[]
  confirmation: TransactionConfirmationResult | null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function logVerificationFlow(message: string, details?: Record<string, unknown>): void {
  if (details) {
    console.info(`[CBS Locker] ${message}`, details)
  } else {
    console.info(`[CBS Locker] ${message}`)
  }
}

function normalizeConfirmationStatus(
  value: string | null | undefined,
): TransactionConfirmationResult['status'] {
  if (value === 'confirmed' || value === 'finalized' || value === 'processed') {
    return value
  }

  return 'unknown'
}

export async function waitForTransactionConfirmation(input: {
  signature: string
  lockPda: string
  vaultPda: string
}): Promise<TransactionConfirmationResult> {
  const rpc = getSolanaRpc()
  assertIsSignature(input.signature)
  const signatureValue = input.signature
  const startedAt = Date.now()
  let useHistorySearch = false

  logVerificationFlow('waiting for transaction confirmation', {
    signature: input.signature,
    lockPda: input.lockPda,
    vaultPda: input.vaultPda,
  })

  while (Date.now() - startedAt < CONFIRMATION_TIMEOUT_MS) {
    const { value } = await rpc
      .getSignatureStatuses([signatureValue], {
        searchTransactionHistory: useHistorySearch,
      })
      .send()

    const status = value[0]

    if (status) {
      if (status.err) {
        logVerificationFlow('transaction confirmation failed', {
          signature: input.signature,
          lockPda: input.lockPda,
          vaultPda: input.vaultPda,
          confirmationStatus: normalizeConfirmationStatus(status.confirmationStatus),
          error: safeJsonStringify(status.err),
        })

        throw new Error(`Transaction failed on-chain: ${safeJsonStringify(status.err)}`)
      }

      const confirmationStatus = normalizeConfirmationStatus(status.confirmationStatus)

      if (
        confirmationStatus === 'confirmed' ||
        confirmationStatus === 'finalized' ||
        confirmationStatus === 'processed' ||
        status.confirmations === null
      ) {
        const result: TransactionConfirmationResult = {
          status:
            confirmationStatus === 'unknown' && status.confirmations === null
              ? 'finalized'
              : confirmationStatus,
          slot: status.slot != null ? String(status.slot) : null,
          err: null,
        }

        logVerificationFlow('transaction confirmed', {
          signature: input.signature,
          lockPda: input.lockPda,
          vaultPda: input.vaultPda,
          confirmationStatus: result.status,
          slot: result.slot,
        })

        return result
      }
    }

    if (Date.now() - startedAt >= CONFIRMATION_POLL_MS * 3) {
      useHistorySearch = true
    }

    await sleep(CONFIRMATION_POLL_MS)
  }

  logVerificationFlow('transaction confirmation timed out', {
    signature: input.signature,
    lockPda: input.lockPda,
    vaultPda: input.vaultPda,
  })

  throw new Error('Transaction confirmation timed out before the lock could be verified.')
}

function resolveLockFromDiagnostics(
  lockPda: string,
  signature: string,
  diagnostics: LockFetchDiagnostics,
): LockRecord | null {
  if (!isLockAccountResolvable(diagnostics)) {
    return null
  }

  const lock = lockRecordFromDiagnostics(lockPda, diagnostics, signature)

  if (!lock) {
    return null
  }

  return {
    ...lock,
    onChainVerified: diagnostics.strictVerification?.verified ?? false,
    createSignature: signature,
  }
}

export async function verifyCreatedLock(input: {
  lockAccount: Address
  signature: string
  lockPda: string
  vaultPda: string
  expectedOwner: string
  skipConfirmationWait?: boolean
  priorConfirmation?: TransactionConfirmationResult | null
}): Promise<VerifyCreatedLockResult> {
  const diagnosticsHistory: LockFetchDiagnostics[] = []

  logVerificationFlow('lockVerification flow started', {
    signature: input.signature,
    lockPda: input.lockPda,
    vaultPda: input.vaultPda,
  })

  const immediateDiagnostics = await inspectLockAccountAtPda({
    lockPda: input.lockPda,
    vaultPda: input.vaultPda,
    signature: input.signature,
    expectedOwner: input.expectedOwner,
    stage: 'immediate-post-send',
    attempt: 1,
  })
  diagnosticsHistory.push(immediateDiagnostics)

  const immediateLock = resolveLockFromDiagnostics(
    input.lockPda,
    input.signature,
    immediateDiagnostics,
  )

  if (immediateLock) {
    logVerificationFlow('lock account found immediately after send-complete', {
      signature: input.signature,
      lockPda: input.lockPda,
      vaultPda: input.vaultPda,
      strictVerification: immediateDiagnostics.strictVerification,
    })

    return {
      lock: immediateLock,
      diagnostics: diagnosticsHistory,
      confirmation: null,
    }
  }

  let confirmation: TransactionConfirmationResult | null = input.priorConfirmation ?? null

  if (!input.skipConfirmationWait) {
    try {
      confirmation = await waitForTransactionConfirmation({
        signature: input.signature,
        lockPda: input.lockPda,
        vaultPda: input.vaultPda,
      })
    } catch (error) {
      logVerificationFlow('continuing verification after confirmation error', {
        signature: input.signature,
        lockPda: input.lockPda,
        vaultPda: input.vaultPda,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const totalAttempts = LOCK_LOOKUP_BACKOFF_MS.length + 1

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    if (attempt > 1) {
      const delayMs = LOCK_LOOKUP_BACKOFF_MS[attempt - 2]!
      logVerificationFlow(`verification retry ${attempt}/${totalAttempts}`, {
        signature: input.signature,
        lockPda: input.lockPda,
        vaultPda: input.vaultPda,
        delayMs,
      })
      await sleep(delayMs)
    } else {
      logVerificationFlow(`verification retry ${attempt}/${totalAttempts}`, {
        signature: input.signature,
        lockPda: input.lockPda,
        vaultPda: input.vaultPda,
        delayMs: 0,
      })
    }

    const diagnostics = await inspectLockAccountAtPda({
      lockPda: input.lockPda,
      vaultPda: input.vaultPda,
      signature: input.signature,
      expectedOwner: input.expectedOwner,
      stage: 'post-confirmation-retry',
      attempt,
      confirmationStatus: confirmation?.status ?? null,
    })
    diagnosticsHistory.push(diagnostics)

    const lock = resolveLockFromDiagnostics(input.lockPda, input.signature, diagnostics)

    if (lock) {
      logVerificationFlow('lock account verified on-chain', {
        signature: input.signature,
        lockPda: input.lockPda,
        vaultPda: input.vaultPda,
        confirmationStatus: confirmation?.status ?? null,
        attempt,
        strictVerification: diagnostics.strictVerification,
      })

      return {
        lock,
        diagnostics: diagnosticsHistory,
        confirmation,
      }
    }
  }

  logVerificationFlow('lock account verification exhausted retries', {
    signature: input.signature,
    lockPda: input.lockPda,
    vaultPda: input.vaultPda,
    confirmationStatus: confirmation?.status ?? null,
    attempts: totalAttempts,
    lastFailureReason: diagnosticsHistory.at(-1)?.failureReason ?? null,
    lastFailureDetail: diagnosticsHistory.at(-1)?.failureDetail ?? null,
  })

  return {
    lock: null,
    diagnostics: diagnosticsHistory,
    confirmation,
  }
}
