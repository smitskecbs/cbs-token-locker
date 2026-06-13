import { address } from '@solana/kit'
import { findAssociatedTokenPda } from '@solana-program/token'

import {
  setLastError,
  setLastSimulationDiagnostics,
  setLastTransactionSignature,
  setLastUnlockDiagnostics,
} from '../state/debugStore'
import { PROGRAM_STATUS_RATE_LIMIT_MESSAGE, RPC_RATE_LIMIT_MESSAGE } from '../state/rpcActivityStore'
import type { LockRecord } from '../types/lock'
import type { SolanaWalletProvider } from '../wallet'
import { getSelectedClusterLabel, getSelectedNetwork } from './cluster'
import { OnChainLockerError } from './client'
import { fetchOnChainLock } from './fetchLock'
import { buildUnlockInstructions } from './instructions'
import { waitForTransactionConfirmation } from './lockVerification'
import { checkProgramDeployed } from './programStatus'
import { getProgramNotDeployedMessage } from './errors'
import { isRpcRateLimitError } from './rpcFetch'
import type { BlockhashLifecycleSnapshot } from './blockhashLifecycle'
import { getSolanaRpc } from './rpc'
import type { SimulationDiagnostics } from './simulationDiagnostics'
import {
  UNLOCK_ERROR_VAULT_LOW_BALANCE,
  UNLOCK_ERROR_VAULT_NOT_FOUND,
  UNLOCK_ERROR_WRONG_WALLET,
  formatUnlockError,
} from './unlockErrors'
import {
  auditUnlockInstructionPlan,
  type UnlockInstructionAudit,
} from './unlockInstructionAudit'
import {
  buildUnlockInstructionAccounts,
  captureUnlockBalanceSnapshots,
  fetchTokenBalanceSnapshot,
  logUnlockDiagnostics,
  type TokenBalanceSnapshot,
  type UnlockTransferDiagnostics,
  verifyUnlockTransfer,
} from './unlockVerification'
import { safeJsonStringify } from '../utils/safeSerialize'
import {
  sendInstructionsWithWallet,
  simulateInstructionsWithDiagnostics,
  TransactionSendError,
  WalletSendError,
  type WalletSendDiagnostics,
} from './sendTransaction'
import { didRpcSimulationSucceed } from './walletSendErrors'

export type UnlockStepId =
  | 'check-lock-status'
  | 'check-vault-balance'
  | 'prepare-transaction'
  | 'wallet-approval'
  | 'confirm-transaction'
  | 'verify-transfer'
  | 'completed'

export type UnlockStepState = 'pending' | 'active' | 'success' | 'error'

export type UnlockProgressReporter = {
  startStep: (step: UnlockStepId) => void
  completeStep: (step: UnlockStepId) => void
  failStep: (step: UnlockStepId, message: string) => void
}

export type UnlockDebugOutput = {
  lockAccount: string
  vaultTokenAccount: string
  ownerWallet: string
  ownerTokenAccount: string | null
  mint: string
  amount: string
  signature: string | null
  simulationDiagnostics: SimulationDiagnostics | null
  unlockDiagnostics: UnlockTransferDiagnostics | null
  beforeBalances: {
    vault: TokenBalanceSnapshot | null
    ownerAta: TokenBalanceSnapshot | null
  } | null
  afterBalances: {
    vault: TokenBalanceSnapshot | null
    ownerAta: TokenBalanceSnapshot | null
  } | null
  ownerAtaWillBeCreated: boolean | null
  instructionAudit: UnlockInstructionAudit | null
  simulationBlockhashLifecycle: BlockhashLifecycleSnapshot | null
  walletBlockhashLifecycle: BlockhashLifecycleSnapshot | null
  simulationCompletedAtMs: number | null
  msBetweenSimulationAndWallet: number | null
  simulationRetriedForBlockhash: boolean | null
  simulationPassed: boolean | null
  walletSendDiagnostics: WalletSendDiagnostics | null
  programLogs: string[]
  error: string | null
  errorRaw: string | null
  failedStep: UnlockStepId | null
}

const noopReporter: UnlockProgressReporter = {
  startStep: () => undefined,
  completeStep: () => undefined,
  failStep: () => undefined,
}

export class UnlockFlowError extends Error {
  readonly diagnostics?: SimulationDiagnostics
  readonly debugOutput: UnlockDebugOutput

  constructor(message: string, debugOutput: UnlockDebugOutput, diagnostics?: SimulationDiagnostics) {
    super(message)
    this.name = 'UnlockFlowError'
    this.debugOutput = debugOutput
    this.diagnostics = diagnostics
  }
}

function createDebugOutput(lock: LockRecord): UnlockDebugOutput {
  return {
    lockAccount: lock.lockAccount,
    vaultTokenAccount: lock.vault,
    ownerWallet: lock.owner,
    ownerTokenAccount: null,
    mint: lock.mint,
    amount: lock.amount,
    signature: null,
    simulationDiagnostics: null,
    unlockDiagnostics: null,
    beforeBalances: null,
    afterBalances: null,
    ownerAtaWillBeCreated: null,
    instructionAudit: null,
    simulationBlockhashLifecycle: null,
    walletBlockhashLifecycle: null,
    simulationCompletedAtMs: null,
    msBetweenSimulationAndWallet: null,
    simulationRetriedForBlockhash: null,
    simulationPassed: null,
    walletSendDiagnostics: null,
    programLogs: [],
    error: null,
    errorRaw: null,
    failedStep: null,
  }
}

function logUnlockStep(step: UnlockStepId, details: Record<string, unknown>): void {
  console.info(`[CBS Locker] unlock step: ${step}`, safeJsonStringify(details))
}

export function buildUnlockDebugText(debugOutput: UnlockDebugOutput): string {
  const lines = [
    'CBS Token Locker — Unlock Debug Output',
    '',
    `Lock account: ${debugOutput.lockAccount}`,
    `Vault token account: ${debugOutput.vaultTokenAccount}`,
    `Owner wallet: ${debugOutput.ownerWallet}`,
    `Owner ATA: ${debugOutput.ownerTokenAccount ?? 'n/a'}`,
    `Mint: ${debugOutput.mint}`,
    `Amount (raw): ${debugOutput.amount}`,
    `Transaction signature: ${debugOutput.signature ?? 'n/a'}`,
    `Owner ATA created in tx: ${debugOutput.ownerAtaWillBeCreated === null ? 'n/a' : debugOutput.ownerAtaWillBeCreated ? 'yes' : 'no'}`,
    `Failed step: ${debugOutput.failedStep ?? 'n/a'}`,
    `Error: ${debugOutput.error ?? 'n/a'}`,
    `Raw error: ${debugOutput.errorRaw ?? 'n/a'}`,
    '',
  ]

  if (debugOutput.beforeBalances) {
    lines.push(
      'Before balances:',
      safeJsonStringify(debugOutput.beforeBalances),
      '',
    )
  }

  if (debugOutput.afterBalances) {
    lines.push(
      'After balances:',
      safeJsonStringify(debugOutput.afterBalances),
      '',
    )
  }

  if (debugOutput.unlockDiagnostics) {
    lines.push(
      'Unlock transfer diagnostics:',
      safeJsonStringify(debugOutput.unlockDiagnostics),
      '',
    )
  }

  if (debugOutput.instructionAudit) {
    lines.push(
      'Unlock instruction audit:',
      safeJsonStringify(debugOutput.instructionAudit),
      '',
    )
  }

  if (
    debugOutput.simulationBlockhashLifecycle ||
    debugOutput.walletBlockhashLifecycle ||
    debugOutput.simulationCompletedAtMs !== null
  ) {
    lines.push(
      'Blockhash lifecycle:',
      safeJsonStringify({
        simulation: debugOutput.simulationBlockhashLifecycle,
        wallet: debugOutput.walletBlockhashLifecycle,
        simulationCompletedAtMs: debugOutput.simulationCompletedAtMs,
        msBetweenSimulationAndWallet: debugOutput.msBetweenSimulationAndWallet,
        simulationRetriedForBlockhash: debugOutput.simulationRetriedForBlockhash,
        simulationPassed: debugOutput.simulationPassed,
      }),
      '',
    )
  }

  if (debugOutput.walletSendDiagnostics) {
    lines.push(
      'Wallet send diagnostics:',
      debugOutput.walletSendDiagnostics.fullText,
      '',
    )
  }

  if (debugOutput.simulationDiagnostics) {
    const simulation = debugOutput.simulationDiagnostics

    lines.push(
      'Simulation details:',
      `  Instruction index: ${simulation.instructionIndex ?? 'n/a'}`,
      `  Custom program error: ${simulation.customProgramError ?? 'n/a'}`,
      `  Anchor error code: ${simulation.anchorErrorCode ?? 'n/a'}`,
      `  Anchor error name: ${simulation.anchorErrorName ?? 'n/a'}`,
      `  Anchor error message: ${simulation.anchorErrorMessage ?? 'n/a'}`,
      `  Account validation failure: ${simulation.accountValidationFailure ?? 'n/a'}`,
      '',
      'Simulation diagnostics:',
      simulation.fullText,
      '',
    )
  } else if (debugOutput.programLogs.length > 0) {
    lines.push('Program logs:', ...debugOutput.programLogs, '')
  }

  return lines.join('\n')
}

async function assertRpcAvailable(): Promise<void> {
  try {
    await getSolanaRpc().getHealth().send()
  } catch (error) {
    if (isRpcRateLimitError(error)) {
      throw new OnChainLockerError(RPC_RATE_LIMIT_MESSAGE)
    }

    throw new OnChainLockerError(
      error instanceof Error ? error.message : 'Solana RPC is unavailable.',
    )
  }
}

async function assertProgramDeployed(): Promise<void> {
  try {
    const status = await checkProgramDeployed(getSelectedNetwork())

    if (!status.statusKnown && status.error) {
      throw new OnChainLockerError(status.error)
    }

    if (!status.deployed) {
      throw new OnChainLockerError(getProgramNotDeployedMessage(getSelectedClusterLabel()))
    }
  } catch (error) {
    if (error instanceof OnChainLockerError) {
      throw error
    }

    if (isRpcRateLimitError(error)) {
      throw new OnChainLockerError(PROGRAM_STATUS_RATE_LIMIT_MESSAGE)
    }

    throw error
  }
}

function failUnlock(
  step: UnlockStepId,
  error: unknown,
  debugOutput: UnlockDebugOutput,
  reporter: UnlockProgressReporter,
  simulationDiagnostics?: SimulationDiagnostics | null,
): never {
  const simulationPassed =
    debugOutput.simulationPassed === true ||
    didRpcSimulationSucceed(simulationDiagnostics ?? debugOutput.simulationDiagnostics)

  const message = formatUnlockError(error, getSelectedClusterLabel(), simulationDiagnostics, {
    simulationPassed,
  })
  const rawMessage = error instanceof Error ? error.message : String(error)

  debugOutput.failedStep = step
  debugOutput.error = message
  debugOutput.errorRaw = rawMessage
  debugOutput.simulationPassed = simulationPassed

  if (error instanceof WalletSendError) {
    debugOutput.walletSendDiagnostics = error.diagnostics
    if (error.priorSimulationDiagnostics) {
      debugOutput.simulationDiagnostics = error.priorSimulationDiagnostics
      debugOutput.programLogs = error.priorSimulationDiagnostics.programLogs
    }
  } else if (simulationDiagnostics) {
    debugOutput.simulationDiagnostics = simulationDiagnostics
    debugOutput.programLogs = simulationDiagnostics.programLogs
  } else if (error instanceof TransactionSendError) {
    debugOutput.simulationDiagnostics = error.diagnostics
    debugOutput.programLogs = error.diagnostics.programLogs
  } else if (error instanceof OnChainLockerError && error.diagnostics) {
    debugOutput.simulationDiagnostics = error.diagnostics
    debugOutput.programLogs = error.diagnostics.programLogs
  }

  console.error('[CBS Locker] unlock failed', buildUnlockDebugText(debugOutput))
  setLastError(message)

  if (debugOutput.simulationDiagnostics) {
    setLastSimulationDiagnostics(debugOutput.simulationDiagnostics)
  }

  if (debugOutput.unlockDiagnostics) {
    setLastUnlockDiagnostics(debugOutput.unlockDiagnostics)
  }

  reporter.failStep(step, message)
  throw new UnlockFlowError(message, debugOutput, debugOutput.simulationDiagnostics ?? undefined)
}

export async function runUnlockFlow(input: {
  lock: LockRecord
  walletProvider: SolanaWalletProvider
  walletAddress: string
  reporter?: UnlockProgressReporter
}): Promise<LockRecord> {
  const reporter = input.reporter ?? noopReporter
  const debugOutput = createDebugOutput(input.lock)

  try {
    reporter.startStep('check-lock-status')
    logUnlockStep('check-lock-status', {
      lockAccount: input.lock.lockAccount,
      ownerWallet: input.walletAddress,
    })

    const freshLock = await fetchOnChainLock(input.lock.lockAccount)

    if (!freshLock) {
      failUnlock('check-lock-status', new OnChainLockerError('Lock account not found on-chain.'), debugOutput, reporter)
    }

    if (freshLock.isUnlocked) {
      failUnlock('check-lock-status', new OnChainLockerError('This lock has already been unlocked.'), debugOutput, reporter)
    }

    if (freshLock.owner !== input.walletAddress) {
      failUnlock('check-lock-status', new OnChainLockerError(UNLOCK_ERROR_WRONG_WALLET), debugOutput, reporter)
    }

    const unlockTime = new Date(freshLock.unlockAt).getTime()

    if (Number.isNaN(unlockTime) || Date.now() < unlockTime) {
      failUnlock('check-lock-status', new OnChainLockerError('Lock period is still active.'), debugOutput, reporter)
    }

    reporter.completeStep('check-lock-status')

    reporter.startStep('check-vault-balance')
    await assertRpcAvailable()
    await assertProgramDeployed()

    const vaultSnapshot = await fetchTokenBalanceSnapshot(freshLock.vault)

    if (!vaultSnapshot.exists) {
      failUnlock('check-vault-balance', new OnChainLockerError(UNLOCK_ERROR_VAULT_NOT_FOUND), debugOutput, reporter)
    }

    const lockedAmount = BigInt(freshLock.amount)
    const vaultBalance = BigInt(vaultSnapshot.amount)

    if (vaultBalance < lockedAmount) {
      failUnlock(
        'check-vault-balance',
        new OnChainLockerError(
          `${UNLOCK_ERROR_VAULT_LOW_BALANCE}. Vault holds ${vaultSnapshot.amount}, expected at least ${freshLock.amount}.`,
        ),
        debugOutput,
        reporter,
      )
    }

    const [ownerTokenAccount] = await findAssociatedTokenPda({
      owner: address(freshLock.owner),
      mint: address(freshLock.mint),
      tokenProgram: address(freshLock.tokenProgram),
    })
    const ownerAtaSnapshot = await fetchTokenBalanceSnapshot(ownerTokenAccount)

    debugOutput.ownerTokenAccount = ownerTokenAccount
    debugOutput.ownerAtaWillBeCreated = !ownerAtaSnapshot.exists

    logUnlockStep('check-vault-balance', {
      vault: vaultSnapshot,
      ownerAta: ownerAtaSnapshot,
      ownerAtaWillBeCreated: debugOutput.ownerAtaWillBeCreated,
    })

    reporter.completeStep('check-vault-balance')

    reporter.startStep('prepare-transaction')

    const plan = await buildUnlockInstructions({
      owner: address(input.walletAddress),
      lockAccount: address(freshLock.lockAccount),
      mint: address(freshLock.mint),
      vault: address(freshLock.vault),
      lockSeed: BigInt(freshLock.lockSeed),
      tokenProgram: address(freshLock.tokenProgram),
      createOwnerAta: debugOutput.ownerAtaWillBeCreated === true,
    })

    const instructionAccounts = buildUnlockInstructionAccounts({
      lockAccount: freshLock.lockAccount,
      vault: freshLock.vault,
      ownerTokenAccount: plan.ownerTokenAccount,
      ownerWallet: input.walletAddress,
      tokenProgram: freshLock.tokenProgram,
    })

    const instructionAudit = await auditUnlockInstructionPlan({
      lock: freshLock,
      owner: address(input.walletAddress),
      plan,
      ownerAtaWillBeCreated: debugOutput.ownerAtaWillBeCreated === true,
    })

    debugOutput.instructionAudit = instructionAudit

    logUnlockStep('prepare-transaction', {
      instructionAccounts,
      instructionCount: plan.instructions.length,
      instructionAudit,
    })

    if (instructionAudit.issues.length > 0) {
      failUnlock(
        'prepare-transaction',
        new OnChainLockerError(instructionAudit.summary),
        debugOutput,
        reporter,
      )
    }

    const transactionContext = {
      lockPda: freshLock.lockAccount,
      vaultPda: freshLock.vault,
      ownerTokenAccount: plan.ownerTokenAccount,
      ownerWallet: input.walletAddress,
      mint: freshLock.mint,
      unlockTimestamp: String(Math.floor(unlockTime / 1000)),
      amount: freshLock.amount,
      lockSeed: freshLock.lockSeed,
    }

    let simulationCompletedAtMs: number | null = null

    try {
      const simulationResult = await simulateInstructionsWithDiagnostics({
        walletAddress: input.walletAddress,
        instructions: plan.instructions,
        context: transactionContext,
      })

      simulationCompletedAtMs = simulationResult.simulationCompletedAtMs
      debugOutput.simulationCompletedAtMs = simulationResult.simulationCompletedAtMs
      debugOutput.simulationRetriedForBlockhash = simulationResult.retriedForBlockhash

      if (simulationResult.diagnostics) {
        debugOutput.simulationDiagnostics = simulationResult.diagnostics
        debugOutput.programLogs = simulationResult.diagnostics.programLogs
        debugOutput.simulationBlockhashLifecycle = simulationResult.blockhashLifecycle
        debugOutput.simulationPassed = didRpcSimulationSucceed(simulationResult.diagnostics)
        setLastSimulationDiagnostics(simulationResult.diagnostics)
      }
    } catch (error) {
      failUnlock('prepare-transaction', error, debugOutput, reporter)
    }

    reporter.completeStep('prepare-transaction')

    const beforeBalances = await captureUnlockBalanceSnapshots({
      vault: freshLock.vault,
      ownerTokenAccount: plan.ownerTokenAccount,
    })

    debugOutput.beforeBalances = beforeBalances

    reporter.startStep('wallet-approval')

    let signature: string

    const walletSendStartedAtMs = Date.now()
    debugOutput.msBetweenSimulationAndWallet =
      simulationCompletedAtMs == null
        ? null
        : Math.max(0, walletSendStartedAtMs - simulationCompletedAtMs)

    try {
      signature = await sendInstructionsWithWallet({
        walletAddress: input.walletAddress,
        walletProvider: input.walletProvider,
        instructions: plan.instructions,
        transactionContext,
        skipPreflightSimulation: true,
        simulationCompletedAtMs,
        simulationPassed: debugOutput.simulationPassed === true,
        priorSimulationDiagnostics: debugOutput.simulationDiagnostics,
      })
    } catch (error) {
      failUnlock('wallet-approval', error, debugOutput, reporter, debugOutput.simulationDiagnostics)
    }

    debugOutput.signature = signature
    setLastTransactionSignature(signature)
    logUnlockStep('wallet-approval', { signature })
    reporter.completeStep('wallet-approval')

    reporter.startStep('confirm-transaction')

    try {
      await waitForTransactionConfirmation({
        signature,
        lockPda: freshLock.lockAccount,
        vaultPda: freshLock.vault,
      })
    } catch (error) {
      failUnlock('confirm-transaction', error, debugOutput, reporter)
    }

    reporter.completeStep('confirm-transaction')

    reporter.startStep('verify-transfer')

    const afterBalances = await captureUnlockBalanceSnapshots({
      vault: freshLock.vault,
      ownerTokenAccount: plan.ownerTokenAccount,
    })

    debugOutput.afterBalances = afterBalances

    const updatedLock = await fetchOnChainLock(freshLock.lockAccount)
    const lockFlagUnlocked = updatedLock?.isUnlocked === true

    const diagnostics = await verifyUnlockTransfer({
      lock: freshLock,
      signature,
      vaultTokenAccount: freshLock.vault,
      ownerTokenAccount: plan.ownerTokenAccount,
      instructionAccounts,
      beforeVault: beforeBalances.vault,
      beforeOwnerAta: beforeBalances.ownerAta,
      afterVault: afterBalances.vault,
      afterOwnerAta: afterBalances.ownerAta,
      lockFlagUnlocked,
    })

    debugOutput.unlockDiagnostics = diagnostics
    logUnlockDiagnostics(diagnostics)
    setLastUnlockDiagnostics(diagnostics)

    if (!diagnostics.transferVerified || !updatedLock) {
      failUnlock(
        'verify-transfer',
        new OnChainLockerError(
          diagnostics.failureReason ??
            'Unlock transaction confirmed but token transfer verification failed.',
        ),
        debugOutput,
        reporter,
      )
    }

    reporter.completeStep('verify-transfer')
    reporter.startStep('completed')
    reporter.completeStep('completed')

    console.info('[CBS Locker] unlock completed', buildUnlockDebugText(debugOutput))

    return {
      ...updatedLock,
      onChainVerified: updatedLock.onChainVerified,
    }
  } catch (error) {
    if (error instanceof UnlockFlowError) {
      throw error
    }

    failUnlock('check-lock-status', error, debugOutput, reporter)
  }
}

export async function unlockOnChainLockWithFlow(
  lockAccount: string,
  walletProvider: SolanaWalletProvider,
  walletAddress: string,
  reporter?: UnlockProgressReporter,
): Promise<LockRecord> {
  const lock = await fetchOnChainLock(lockAccount)

  if (!lock) {
    throw new OnChainLockerError('Lock account not found on-chain.')
  }

  return runUnlockFlow({
    lock,
    walletProvider,
    walletAddress,
    reporter,
  })
}
