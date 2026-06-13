import { BLOCKHASH_EXPIRED_USER_MESSAGE, isBlockhashNotFoundError, type BlockhashLifecycleSnapshot } from './blockhashLifecycle'
import { safeJsonStringify } from '../utils/safeSerialize'
import type { SimulationDiagnostics } from './simulationDiagnostics'
import type { TransactionWireInfo, WalletInputType } from './transactionWire'

export const UNLOCK_ERROR_WALLET_SIGNING_FAILED = 'Wallet signing/sending failed'
export const UNLOCK_ERROR_WALLET_SUBMIT_FAILED =
  'Wallet could not submit the transaction. Try another wallet or reconnect.'
export const ERROR_TRANSACTION_SIGNED_NOT_SUBMITTED =
  'Transaction signed but could not be submitted.'

export type WalletSendDiagnostics = {
  summary: string
  simulationPassed: boolean
  walletMethod: string | null
  walletError: string
  walletErrorRaw: string
  fallbackAttempted: boolean
  wireByteLength: number | null
  signedTransactionBytes: number | null
  rpcSendSignature: string | null
  rpcSendResult: string | null
  confirmationStatus: string | null
  signature: string | null
  transactionWireInfo: TransactionWireInfo | null
  walletInputType: WalletInputType | null
  walletProviderName: string | null
  blockhashLifecycle: BlockhashLifecycleSnapshot | null
  fullText: string
}

export class WalletSendError extends Error {
  readonly diagnostics: WalletSendDiagnostics
  readonly priorSimulationDiagnostics: SimulationDiagnostics | null

  constructor(
    message: string,
    diagnostics: WalletSendDiagnostics,
    priorSimulationDiagnostics: SimulationDiagnostics | null = null,
  ) {
    super(message)
    this.name = 'WalletSendError'
    this.diagnostics = diagnostics
    this.priorSimulationDiagnostics = priorSimulationDiagnostics
  }
}

export function isGenericWalletApiError(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  return normalized === 'unexpected error' || normalized.includes('unexpected error')
}

export function isWalletUserRejection(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  const normalized = message.toLowerCase()

  return (
    normalized.includes('user rejected') ||
    normalized.includes('user declined') ||
    normalized.includes('rejected the request') ||
    normalized.includes('transaction cancelled') ||
    normalized.includes('wallet rejected') ||
    normalized.includes('user cancelled') ||
    normalized.includes('cancelled the request')
  )
}

export function didRpcSimulationSucceed(diagnostics: SimulationDiagnostics | null): boolean {
  if (!diagnostics) {
    return false
  }

  if (diagnostics.source !== 'rpc-simulation') {
    return false
  }

  if (diagnostics.instructionIndex !== null || diagnostics.customProgramError !== null) {
    return false
  }

  const failureLog = diagnostics.programLogs.find((line) => {
    const normalized = line.toLowerCase()
    return (
      normalized.includes('failed') ||
      normalized.includes('anchorerror') ||
      normalized.includes('custom program error') ||
      normalized.includes('error:')
    )
  })

  if (failureLog) {
    return false
  }

  return diagnostics.programLogs.some((line) => line.toLowerCase().includes('success'))
}

export function isTransactionSignedNotSubmittedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes(ERROR_TRANSACTION_SIGNED_NOT_SUBMITTED)
}

export function resolveWalletFailureMessage(input: {
  walletError: string
  simulationPassed: boolean
  rejected: boolean
}): string {
  if (input.rejected) {
    return 'Wallet rejected the transaction'
  }

  if (isTransactionSignedNotSubmittedError(input.walletError)) {
    return ERROR_TRANSACTION_SIGNED_NOT_SUBMITTED
  }

  if (isBlockhashNotFoundError(input.walletError)) {
    return BLOCKHASH_EXPIRED_USER_MESSAGE
  }

  if (input.simulationPassed && isGenericWalletApiError(input.walletError)) {
    return UNLOCK_ERROR_WALLET_SUBMIT_FAILED
  }

  if (input.simulationPassed) {
    return UNLOCK_ERROR_WALLET_SIGNING_FAILED
  }

  if (isGenericWalletApiError(input.walletError)) {
    return UNLOCK_ERROR_WALLET_SUBMIT_FAILED
  }

  return input.walletError.trim() || UNLOCK_ERROR_WALLET_SIGNING_FAILED
}

export function buildWalletSendDiagnostics(input: {
  walletError: unknown
  simulationPassed: boolean
  walletMethod: string | null
  fallbackAttempted: boolean
  wireByteLength: number | null
  signedTransactionBytes?: number | null
  rpcSendSignature?: string | null
  rpcSendResult?: string | null
  confirmationStatus?: string | null
  signature: string | null
  transactionWireInfo?: TransactionWireInfo | null
  walletInputType?: WalletInputType | null
  walletProviderName?: string | null
  blockhashLifecycle: BlockhashLifecycleSnapshot | null
  priorSimulationDiagnostics?: SimulationDiagnostics | null
}): WalletSendDiagnostics {
  const walletErrorRaw = input.walletError instanceof Error ? input.walletError.message : String(input.walletError)
  const rejected = isWalletUserRejection(input.walletError)
  const summary = resolveWalletFailureMessage({
    walletError: walletErrorRaw,
    simulationPassed: input.simulationPassed,
    rejected,
  })

  const lines = [
    'Wallet send diagnostics:',
    `Summary: ${summary}`,
    `Simulation passed: ${input.simulationPassed ? 'true' : 'false'}`,
    `Wallet method: ${input.walletMethod ?? 'n/a'}`,
    `Fallback attempted: ${input.fallbackAttempted ? 'true' : 'false'}`,
    `Wire byte length: ${input.wireByteLength ?? 'n/a'}`,
    `Signed transaction bytes: ${input.signedTransactionBytes ?? 'n/a'}`,
    `RPC send signature: ${input.rpcSendSignature ?? 'n/a'}`,
    `RPC send result: ${input.rpcSendResult ?? 'n/a'}`,
    `Confirmation status: ${input.confirmationStatus ?? 'n/a'}`,
    `Signature: ${input.signature ?? 'n/a'}`,
    `Transaction version: ${input.transactionWireInfo?.messageVersion ?? 'n/a'}`,
    `Deserializer path: ${input.transactionWireInfo?.deserializerPath ?? 'n/a'}`,
    `First wire byte: ${input.transactionWireInfo?.firstWireByte ?? 'n/a'}`,
    `Wallet input type: ${input.walletInputType ?? 'n/a'}`,
    `Wallet provider: ${input.walletProviderName ?? 'n/a'}`,
    `Wallet error: ${summary}`,
    `Wallet error raw: ${walletErrorRaw}`,
    '',
    'Blockhash lifecycle:',
    safeJsonStringify(input.blockhashLifecycle),
    '',
  ]

  if (input.priorSimulationDiagnostics) {
    lines.push(
      'Prior RPC simulation diagnostics:',
      input.priorSimulationDiagnostics.fullText,
      '',
    )
  }

  return {
    summary,
    simulationPassed: input.simulationPassed,
    walletMethod: input.walletMethod,
    walletError: summary,
    walletErrorRaw,
    fallbackAttempted: input.fallbackAttempted,
    wireByteLength: input.wireByteLength,
    signedTransactionBytes: input.signedTransactionBytes ?? null,
    rpcSendSignature: input.rpcSendSignature ?? null,
    rpcSendResult: input.rpcSendResult ?? null,
    confirmationStatus: input.confirmationStatus ?? null,
    signature: input.signature,
    transactionWireInfo: input.transactionWireInfo ?? null,
    walletInputType: input.walletInputType ?? null,
    walletProviderName: input.walletProviderName ?? null,
    blockhashLifecycle: input.blockhashLifecycle,
    fullText: lines.join('\n'),
  }
}

export function createWalletSendError(input: {
  walletError: unknown
  simulationPassed: boolean
  walletMethod: string | null
  fallbackAttempted: boolean
  wireByteLength: number | null
  signedTransactionBytes?: number | null
  rpcSendSignature?: string | null
  rpcSendResult?: string | null
  confirmationStatus?: string | null
  signature?: string | null
  transactionWireInfo?: TransactionWireInfo | null
  walletInputType?: WalletInputType | null
  walletProviderName?: string | null
  blockhashLifecycle: BlockhashLifecycleSnapshot | null
  priorSimulationDiagnostics?: SimulationDiagnostics | null
}): WalletSendError {
  const diagnostics = buildWalletSendDiagnostics({
    ...input,
    signature: input.signature ?? null,
  })

  return new WalletSendError(diagnostics.summary, diagnostics, input.priorSimulationDiagnostics ?? null)
}
