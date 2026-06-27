import { address } from '@solana/kit'

import {
  setLastError,
  setLastLockPdas,
  setLastTransactionSignature,
} from '../state/debugStore'
import { getProgramStatus } from '../state/programStore'
import { PROGRAM_STATUS_RATE_LIMIT_MESSAGE } from '../state/rpcActivityStore'
import type { CreateLockInput, LockRecord } from '../types/lock'
import type { SolanaWalletProvider } from '../wallet'
import { getSelectedClusterLabel } from './cluster'
import { OnChainLockerError } from './client'
import { formatLockerError, getProgramNotDeployedMessage } from './errors'
import { buildCreateLockInstructions } from './instructions'
import type { LockFetchDiagnostics } from './lockDiagnostics'
import {
  verifyCreatedLock,
  waitForTransactionConfirmation,
  type TransactionConfirmationResult,
} from './lockVerification'
import { checkProgramDeployed } from './programStatus'
import { isRpcRateLimitError } from './rpcFetch'
import type { SimulationDiagnostics } from './simulationDiagnostics'
import {
  sendInstructionsWithWallet,
  TransactionSendError,
  WalletSendError,
  type WalletSendDiagnostics,
  type WalletSendProgressReporter,
} from './sendTransaction'
import {
  isTransactionSignedNotSubmittedError,
} from './walletSendErrors'
import { validateOwnerTokenBalance } from './tokenBalance'
import { combineUnlockDateTime } from '../utils/time'
import { safeJsonStringify } from '../utils/safeSerialize'

export type CreateLockStepId =
  | 'checking-wallet'
  | 'preparing-transaction'
  | 'waiting-wallet-approval'
  | 'sending-transaction'
  | 'confirming-transaction'
  | 'verifying-lock'
  | 'completed'

export type CreateLockProgressReporter = {
  startStep: (step: CreateLockStepId) => void
  completeStep: (step: CreateLockStepId) => void
  failStep: (step: CreateLockStepId, message: string) => void
}

export type CreateLockDebugOutput = {
  ownerWallet: string
  mint: string
  amount: string
  lockAccount: string | null
  vaultAccount: string | null
  signature: string | null
  confirmationStatus: string | null
  lockVerificationDiagnostics: LockFetchDiagnostics[] | null
  simulationDiagnostics: SimulationDiagnostics | null
  walletSendDiagnostics: WalletSendDiagnostics | null
  error: string | null
  errorRaw: string | null
  failedStep: CreateLockStepId | null
}

const noopReporter: CreateLockProgressReporter = {
  startStep: () => undefined,
  completeStep: () => undefined,
  failStep: () => undefined,
}

export class CreateLockFlowError extends Error {
  readonly diagnostics?: SimulationDiagnostics
  readonly debugOutput: CreateLockDebugOutput

  constructor(message: string, debugOutput: CreateLockDebugOutput, diagnostics?: SimulationDiagnostics) {
    super(message)
    this.name = 'CreateLockFlowError'
    this.debugOutput = debugOutput
    this.diagnostics = diagnostics
  }
}

function tokenTypeToByte(tokenType: CreateLockInput['tokenType']): number {
  if (tokenType === 'spl') {
    return 0
  }

  if (tokenType === 'lp') {
    return 1
  }

  if (tokenType === 'clmm') {
    return 2
  }

  throw new OnChainLockerError('Invalid token type.')
}

function deriveLockSeed(): bigint {
  return BigInt(Date.now())
}

function createDebugOutput(input: CreateLockInput): CreateLockDebugOutput {
  return {
    ownerWallet: input.lockerWallet,
    mint: input.tokenMint.trim(),
    amount: input.amount.trim(),
    lockAccount: null,
    vaultAccount: null,
    signature: null,
    confirmationStatus: null,
    lockVerificationDiagnostics: null,
    simulationDiagnostics: null,
    walletSendDiagnostics: null,
    error: null,
    errorRaw: null,
    failedStep: null,
  }
}

function logCreateLockStep(step: CreateLockStepId, details: Record<string, unknown>): void {
  console.info(`[CBS Locker] create lock step: ${step}`, safeJsonStringify(details))
}

export function buildCreateLockDebugText(debugOutput: CreateLockDebugOutput): string {
  const lines = [
    'CBS Token Locker — Create Lock Debug Output',
    '',
    `Owner wallet: ${debugOutput.ownerWallet}`,
    `Mint: ${debugOutput.mint}`,
    `Amount: ${debugOutput.amount}`,
    `Lock account: ${debugOutput.lockAccount ?? 'n/a'}`,
    `Vault account: ${debugOutput.vaultAccount ?? 'n/a'}`,
    `Transaction signature: ${debugOutput.signature ?? 'n/a'}`,
    `Confirmation status: ${debugOutput.confirmationStatus ?? 'n/a'}`,
    `Failed step: ${debugOutput.failedStep ?? 'n/a'}`,
    `Error: ${debugOutput.error ?? 'n/a'}`,
    `Raw error: ${debugOutput.errorRaw ?? 'n/a'}`,
    '',
  ]

  if (debugOutput.walletSendDiagnostics) {
    lines.push('Wallet send diagnostics:', debugOutput.walletSendDiagnostics.fullText, '')
  }

  if (debugOutput.simulationDiagnostics) {
    lines.push('Simulation diagnostics:', debugOutput.simulationDiagnostics.fullText, '')
  }

  if (debugOutput.lockVerificationDiagnostics) {
    lines.push(
      'Lock verification diagnostics:',
      safeJsonStringify(debugOutput.lockVerificationDiagnostics),
      '',
    )
  }

  return lines.join('\n')
}

function failCreateLock(
  step: CreateLockStepId,
  error: unknown,
  debugOutput: CreateLockDebugOutput,
  reporter: CreateLockProgressReporter,
): never {
  const message =
    error instanceof OnChainLockerError
      ? error.message
      : error instanceof WalletSendError
        ? error.diagnostics.summary
        : error instanceof TransactionSendError
          ? error.message
          : formatLockerError(error, getSelectedClusterLabel())

  const rawMessage = error instanceof Error ? error.message : String(error)

  debugOutput.failedStep = step
  debugOutput.error = message
  debugOutput.errorRaw = rawMessage

  if (error instanceof WalletSendError) {
    debugOutput.walletSendDiagnostics = error.diagnostics
  } else if (error instanceof TransactionSendError) {
    debugOutput.simulationDiagnostics = error.diagnostics
  } else if (error instanceof OnChainLockerError && error.diagnostics) {
    debugOutput.simulationDiagnostics = error.diagnostics
  }

  console.error('[CBS Locker] create lock failed', buildCreateLockDebugText(debugOutput))
  setLastError(message)
  reporter.failStep(step, message)
  throw new CreateLockFlowError(message, debugOutput, debugOutput.simulationDiagnostics ?? undefined)
}

async function assertProgramDeployedForCreate(): Promise<void> {
  const programStatus = getProgramStatus()

  if (!programStatus.statusKnown && programStatus.error) {
    throw new OnChainLockerError(programStatus.error)
  }

  if (!programStatus.deployed) {
    try {
      const deployment = await checkProgramDeployed(programStatus.cluster)

      if (!deployment.deployed) {
        throw new OnChainLockerError(getProgramNotDeployedMessage(getSelectedClusterLabel()))
      }
    } catch (error) {
      if (isRpcRateLimitError(error)) {
        throw new OnChainLockerError(PROGRAM_STATUS_RATE_LIMIT_MESSAGE)
      }

      throw error
    }
  }
}

function createWalletSendProgressReporter(
  reporter: CreateLockProgressReporter,
): WalletSendProgressReporter {
  return {
    onPhaseStart: (phase) => {
      if (phase === 'wallet-approval') {
        reporter.startStep('waiting-wallet-approval')
      }

      if (phase === 'sending-transaction') {
        reporter.startStep('sending-transaction')
      }
    },
    onPhaseComplete: (phase) => {
      if (phase === 'wallet-approval') {
        reporter.completeStep('waiting-wallet-approval')
      }

      if (phase === 'sending-transaction') {
        reporter.completeStep('sending-transaction')
      }
    },
  }
}

export async function runCreateLockFlow(input: {
  createInput: CreateLockInput
  walletProvider: SolanaWalletProvider
  reporter?: CreateLockProgressReporter
}): Promise<LockRecord> {
  const reporter = input.reporter ?? noopReporter
  const debugOutput = createDebugOutput(input.createInput)

  try {
    reporter.startStep('checking-wallet')
    logCreateLockStep('checking-wallet', {
      ownerWallet: input.createInput.lockerWallet,
    })

    if (!input.createInput.lockerWallet) {
      failCreateLock(
        'checking-wallet',
        new OnChainLockerError('Connect a wallet before creating an on-chain lock.'),
        debugOutput,
        reporter,
      )
    }

    await assertProgramDeployedForCreate()

    const unlockAt = combineUnlockDateTime(
      input.createInput.unlockDate,
      input.createInput.unlockTime,
    )
    const unlockTimestamp = Math.floor(new Date(unlockAt).getTime() / 1000)

    if (!Number.isFinite(unlockTimestamp) || unlockTimestamp <= Math.floor(Date.now() / 1000)) {
      failCreateLock(
        'checking-wallet',
        new OnChainLockerError('Unlock date must be in the future.'),
        debugOutput,
        reporter,
      )
    }

    reporter.completeStep('checking-wallet')

    reporter.startStep('preparing-transaction')

    const mint = address(input.createInput.tokenMint.trim())
    const owner = address(input.createInput.lockerWallet)
    const { rawAmount } = await validateOwnerTokenBalance({
      ownerAddress: input.createInput.lockerWallet,
      mintAddress: input.createInput.tokenMint.trim(),
      amount: input.createInput.amount,
    })

    const lockSeed = deriveLockSeed()

    const plan = await buildCreateLockInstructions({
      owner,
      mint,
      amount: rawAmount,
      unlockTimestamp,
      lockSeed,
      tokenType: tokenTypeToByte(input.createInput.tokenType),
      projectName: input.createInput.projectName.trim().slice(0, 48),
    })

    debugOutput.lockAccount = plan.lockAccount
    debugOutput.vaultAccount = plan.vault
    debugOutput.amount = rawAmount.toString()
    setLastLockPdas(plan.lockAccount, plan.vault)

    logCreateLockStep('preparing-transaction', {
      lockPda: plan.lockAccount,
      vaultPda: plan.vault,
      lockSeed: lockSeed.toString(),
    })

    reporter.completeStep('preparing-transaction')

    let signature: string

    try {
      signature = await sendInstructionsWithWallet({
        walletAddress: input.createInput.lockerWallet,
        walletProvider: input.walletProvider,
        instructions: plan.instructions,
        transactionContext: {
          lockPda: plan.lockAccount,
          vaultPda: plan.vault,
          ownerTokenAccount: plan.ownerTokenAccount,
          ownerWallet: input.createInput.lockerWallet,
          mint: input.createInput.tokenMint.trim(),
          unlockTimestamp: String(unlockTimestamp),
          amount: rawAmount.toString(),
          lockSeed: lockSeed.toString(),
        },
        walletSendProgress: createWalletSendProgressReporter(reporter),
      })
    } catch (error) {
      const failedStep: CreateLockStepId = isTransactionSignedNotSubmittedError(error)
        ? 'sending-transaction'
        : 'waiting-wallet-approval'

      failCreateLock(failedStep, error, debugOutput, reporter)
    }

    debugOutput.signature = signature
    setLastTransactionSignature(signature)
    logCreateLockStep('sending-transaction', { signature })

    reporter.startStep('confirming-transaction')

    let confirmation: TransactionConfirmationResult

    try {
      confirmation = await waitForTransactionConfirmation({
        signature,
        lockPda: plan.lockAccount,
        vaultPda: plan.vault,
      })
    } catch (error) {
      failCreateLock('confirming-transaction', error, debugOutput, reporter)
    }

    debugOutput.confirmationStatus = confirmation.status
    logCreateLockStep('confirming-transaction', {
      signature,
      confirmationStatus: confirmation.status,
    })
    reporter.completeStep('confirming-transaction')

    reporter.startStep('verifying-lock')

    const verification = await verifyCreatedLock({
      lockAccount: address(plan.lockAccount),
      signature,
      lockPda: plan.lockAccount,
      vaultPda: plan.vault,
      expectedOwner: input.createInput.lockerWallet,
      skipConfirmationWait: true,
      priorConfirmation: confirmation,
    })

    debugOutput.lockVerificationDiagnostics = verification.diagnostics

    if (!verification.lock) {
      failCreateLock(
        'verifying-lock',
        new OnChainLockerError(
          'Transaction submitted but the on-chain lock account could not be verified yet. Check again shortly.',
        ),
        debugOutput,
        reporter,
      )
    }

    logCreateLockStep('verifying-lock', {
      lockAccount: verification.lock.lockAccount,
      vaultAccount: verification.lock.vault,
    })
    reporter.completeStep('verifying-lock')

    reporter.startStep('completed')
    reporter.completeStep('completed')

    console.info('[CBS Locker] create lock completed', buildCreateLockDebugText(debugOutput))

    return verification.lock
  } catch (error) {
    if (error instanceof CreateLockFlowError) {
      throw error
    }

    failCreateLock('checking-wallet', error, debugOutput, reporter)
  }
}
