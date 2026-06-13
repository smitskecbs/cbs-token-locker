import { OnChainLockerError } from './client'
import { RPC_RATE_LIMIT_MESSAGE } from '../state/rpcActivityStore'
import { BLOCKHASH_EXPIRED_USER_MESSAGE, isBlockhashNotFoundError } from './blockhashLifecycle'
import { TransactionSendError } from './transactionSimulation'
import type { SimulationDiagnostics } from './simulationDiagnostics'
import {
  didRpcSimulationSucceed,
  isGenericWalletApiError,
  isWalletUserRejection,
  UNLOCK_ERROR_WALLET_SIGNING_FAILED,
  UNLOCK_ERROR_WALLET_SUBMIT_FAILED,
  WalletSendError,
} from './walletSendErrors'
import { formatLockerError } from './errors'
import { isRpcRateLimitError } from './rpcFetch'

export const UNLOCK_ERROR_VAULT_NOT_FOUND = 'Vault token account not found'
export const UNLOCK_ERROR_VAULT_LOW_BALANCE = 'Vault balance is lower than expected'
export const UNLOCK_ERROR_WRONG_WALLET = 'Only the original locker wallet can unlock this lock'
export const UNLOCK_ERROR_WALLET_REJECTED = 'Wallet rejected the transaction'
export const UNLOCK_ERROR_SIMULATION_FAILED = 'Unlock transaction failed during simulation'
export const UNLOCK_ERROR_BLOCKHASH_EXPIRED = BLOCKHASH_EXPIRED_USER_MESSAGE

export type UnlockErrorFormatOptions = {
  simulationPassed?: boolean
}

export function formatUnlockError(
  error: unknown,
  clusterLabel: string,
  simulationDiagnostics?: SimulationDiagnostics | null,
  options?: UnlockErrorFormatOptions,
): string {
  const simulationPassed =
    options?.simulationPassed === true ||
    didRpcSimulationSucceed(simulationDiagnostics ?? null)

  if (error instanceof WalletSendError) {
    return error.diagnostics.summary
  }

  if (error instanceof TransactionSendError) {
    const summary = error.diagnostics.summary.trim()

    if (summary.includes(BLOCKHASH_EXPIRED_USER_MESSAGE)) {
      return UNLOCK_ERROR_BLOCKHASH_EXPIRED
    }

    if (error.diagnostics.source === 'wallet' || simulationPassed) {
      const walletMessage = summary.split(' ')[0] === 'Unexpected'
        ? summary
        : summary

      if (isWalletUserRejection(walletMessage)) {
        return UNLOCK_ERROR_WALLET_REJECTED
      }

      if (isGenericWalletApiError(walletMessage) || isGenericUnexpectedError(walletMessage)) {
        return simulationPassed
          ? UNLOCK_ERROR_WALLET_SUBMIT_FAILED
          : UNLOCK_ERROR_WALLET_SIGNING_FAILED
      }

      if (simulationPassed) {
        return UNLOCK_ERROR_WALLET_SIGNING_FAILED
      }
    }

    if (summary && !isGenericUnexpectedError(summary)) {
      return summary
    }

    if (simulationPassed) {
      return UNLOCK_ERROR_WALLET_SIGNING_FAILED
    }

    return formatUnlockSimulationMessage(error.diagnostics)
  }

  if (error instanceof OnChainLockerError) {
    const diagnostics = error.diagnostics ?? simulationDiagnostics

    if (diagnostics) {
      const formatted = formatUnlockSimulationMessage(diagnostics)

      if (formatted !== UNLOCK_ERROR_SIMULATION_FAILED) {
        return formatted
      }
    }

    if (error.message && !isGenericUnexpectedError(error.message)) {
      return error.message
    }
  }

  const message = extractUnlockErrorMessage(error)

  if (isBlockhashNotFoundError(error) || isBlockhashNotFoundMessage(message)) {
    return UNLOCK_ERROR_BLOCKHASH_EXPIRED
  }

  if (isRpcRateLimitError(error) || isRateLimitMessage(message)) {
    return RPC_RATE_LIMIT_MESSAGE
  }

  if (isWalletRejectedMessage(message)) {
    return UNLOCK_ERROR_WALLET_REJECTED
  }

  if (isGenericUnexpectedError(message)) {
    if (simulationPassed) {
      return UNLOCK_ERROR_WALLET_SUBMIT_FAILED
    }

    if (simulationDiagnostics) {
      return formatUnlockSimulationMessage(simulationDiagnostics)
    }

    return UNLOCK_ERROR_SIMULATION_FAILED
  }

  if (
    message.includes(UNLOCK_ERROR_VAULT_NOT_FOUND) ||
    message.includes(UNLOCK_ERROR_VAULT_LOW_BALANCE) ||
    message.includes(UNLOCK_ERROR_WRONG_WALLET)
  ) {
    return message
  }

  const formatted = formatLockerError(error, clusterLabel)

  if (isWalletRejectedMessage(formatted)) {
    return UNLOCK_ERROR_WALLET_REJECTED
  }

  if (formatted.toLowerCase().includes('simulation failed') || formatted.toLowerCase().includes('simulation')) {
    if (simulationPassed) {
      return UNLOCK_ERROR_WALLET_SIGNING_FAILED
    }

    if (simulationDiagnostics) {
      return formatUnlockSimulationMessage(simulationDiagnostics)
    }

    return UNLOCK_ERROR_SIMULATION_FAILED
  }

  return formatted
}

export function formatUnlockSimulationMessage(diagnostics: SimulationDiagnostics): string {
  const parts: string[] = []

  if (diagnostics.summary && !isGenericUnexpectedError(diagnostics.summary)) {
    parts.push(diagnostics.summary)
  } else {
    parts.push(UNLOCK_ERROR_SIMULATION_FAILED)
  }

  if (diagnostics.instructionIndex !== null) {
    parts.push(`Instruction index: ${diagnostics.instructionIndex}`)
  }

  if (diagnostics.anchorErrorName) {
    parts.push(`Anchor error: ${diagnostics.anchorErrorName}`)
  }

  if (diagnostics.anchorErrorMessage) {
    parts.push(diagnostics.anchorErrorMessage)
  }

  if (diagnostics.customProgramError !== null && !diagnostics.anchorErrorName) {
    parts.push(`Custom program error: ${diagnostics.customProgramError}`)
  }

  if (diagnostics.accountValidationFailure) {
    parts.push(`Account validation: ${diagnostics.accountValidationFailure}`)
  }

  const failedLog = diagnostics.programLogs.find((line) => {
    return line.includes('failed') || line.includes('Error') || line.includes('custom program error')
  })

  if (failedLog) {
    parts.push(failedLog)
  }

  return parts.join(' · ')
}

function extractUnlockErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return 'Unable to unlock tokens.'
}

function isGenericUnexpectedError(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  return normalized === 'unexpected error' || normalized.includes('unexpected error')
}

function isWalletRejectedMessage(message: string): boolean {
  const normalized = message.toLowerCase()

  return (
    normalized.includes('user rejected') ||
    normalized.includes('user declined') ||
    normalized.includes('rejected the request') ||
    normalized.includes('transaction cancelled') ||
    normalized.includes('wallet rejected')
  )
}

function isRateLimitMessage(message: string): boolean {
  const normalized = message.toLowerCase()

  return (
    normalized.includes('429') ||
    normalized.includes('too many requests') ||
    normalized.includes('rate limit') ||
    normalized.includes('rate-limiting')
  )
}

function isBlockhashNotFoundMessage(message: string): boolean {
  const normalized = message.toLowerCase()
  return normalized.includes('blockhashnotfound') || normalized.includes('block hash not found')
}
