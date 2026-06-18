import { isSolanaError } from '@solana/kit'

import { OnChainLockerError } from './client'
import { LockerValidationError } from '../locker'
import { LockApiError } from '../services/lockApiError'
import { RPC_RATE_LIMIT_MESSAGE } from '../state/rpcActivityStore'
import { isRpcRateLimitError } from './rpcFetch'

const PROGRAM_NOT_DEPLOYED_MESSAGE =
  'CBS Locker Program is not deployed on this cluster yet.'

export function getProgramNotDeployedMessage(cluster: string): string {
  return `CBS Locker Program is not deployed on ${cluster} yet.`
}

export function formatLockerError(error: unknown, cluster = 'this cluster'): string {
  if (error instanceof LockApiError) {
    return error.message
  }

  if (error instanceof LockerValidationError || error instanceof OnChainLockerError) {
    return error.message
  }

  if (error instanceof Error && error.message === 'PROGRAM_NOT_DEPLOYED') {
    return getProgramNotDeployedMessage(cluster)
  }

  const message = extractErrorMessage(error)
  const normalized = message.toLowerCase()

  if (
    normalized.includes('user rejected') ||
    normalized.includes('user declined') ||
    normalized.includes('rejected the request') ||
    normalized.includes('transaction cancelled')
  ) {
    return 'Wallet rejected the transaction.'
  }

  if (normalized.includes('serialize is not a function')) {
    return 'Wallet transaction format mismatch. Reload the page and retry with your Solana wallet.'
  }

  if (normalized.includes('serialize a bigint')) {
    return 'Transaction simulation could not be reported. Retry the lock; the wallet will validate the transaction.'
  }

  if (
    normalized.includes('simulation failed') ||
    normalized.includes('reverted during simulation') ||
    normalized.includes('preflight') ||
    normalized.includes('transaction simulation failed')
  ) {
    if (
      message.includes('Instruction index:') ||
      message.includes('Anchor error:') ||
      message.includes('Custom program error:')
    ) {
      return message
    }

    return `Transaction simulation failed: ${summarizeSimulationLogs(error) || message}`
  }

  if (
    normalized.includes('token account not found') ||
    normalized.includes('could not find account') ||
    normalized.includes('account not found') ||
    normalized.includes('owner does not own')
  ) {
    return 'Token account not found for this wallet and mint on the selected cluster.'
  }

  if (
    normalized.includes('insufficient') ||
    normalized.includes('not enough tokens') ||
    normalized.includes('custom program error: 0x1')
  ) {
    return 'Insufficient token balance for the requested lock amount.'
  }

  if (
    normalized.includes('invalid mint') ||
    normalized.includes('mint account not found') ||
    normalized.includes('not a valid mint')
  ) {
    return 'Invalid mint address or mint account not found on the selected cluster.'
  }

  if (isRpcRateLimitError(error)) {
    return RPC_RATE_LIMIT_MESSAGE
  }

  if (
    normalized.includes('failed to fetch') ||
    normalized.includes('network') ||
    normalized.includes('429') ||
    normalized.includes('503') ||
    normalized.includes('rpc')
  ) {
    if (normalized.includes('429') || normalized.includes('too many requests') || normalized.includes('rate limit')) {
      return RPC_RATE_LIMIT_MESSAGE
    }

    return `RPC error while contacting Solana: ${message}`
  }

  if (normalized.includes('program') && normalized.includes('not deployed')) {
    return getProgramNotDeployedMessage(cluster)
  }

  return message || 'Unable to complete the on-chain lock request.'
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  if (isSolanaError(error)) {
    return error.message
  }

  return 'Unknown error'
}

function summarizeSimulationLogs(error: unknown): string | null {
  const context = error as {
    context?: {
      logs?: string[]
      __serverMessage?: string
    }
  }

  const logs = context.context?.logs

  if (Array.isArray(logs) && logs.length > 0) {
    const relevant = logs.filter((line) => {
      return line.includes('Error') || line.includes('failed') || line.includes('Program')
    })

    return (relevant.length > 0 ? relevant : logs).slice(-3).join(' ')
  }

  if (context.context?.__serverMessage) {
    return context.context.__serverMessage
  }

  return null
}

export { PROGRAM_NOT_DEPLOYED_MESSAGE }
