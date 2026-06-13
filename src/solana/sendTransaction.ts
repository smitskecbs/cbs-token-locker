import {
  assertIsSendableTransaction,
  assertIsSignature,
  getBase64EncodedWireTransaction,
  type Instruction,
} from '@solana/kit'
import { getBase58Decoder } from '@solana/codecs-strings'

import {
  isBlockhashNotFoundError,
  isCompiledBlockhashStillValid,
  logBlockhashLifecycle,
  type BlockhashLifecycleSnapshot,
} from './blockhashLifecycle'
import { isDevelopmentMode } from '../state/debugStore'
import type { SolanaWalletProvider } from '../wallet'
import { getConnectedWalletInfo } from '../wallet'
import { serializeForDebug } from '../utils/safeSerialize'
import { getSelectedClusterLabel } from './cluster'
import { formatLockerError } from './errors'
import { getSolanaRpc } from './rpc'
import type { SimulationDiagnostics, TransactionContextSnapshot } from './simulationDiagnostics'
import {
  compileWalletTransaction,
  enrichWalletFailureWithSimulation,
  simulateCompiledTransactionStrict,
  simulateInstructionsWithFreshBlockhash,
  type CompiledWalletTransaction,
  TransactionSendError,
} from './transactionSimulation'
import {
  createTransactionWireInfo,
  createInjectedWalletSerializeWrapper,
  decodeSignedWireTransaction,
  extractSignedWireBytes,
  getTransactionWireBytes,
  getWalletInputType,
  supportsSignTransactionRpcFallback,
  type TransactionWireInfo,
  type WalletInputType,
} from './transactionWire'
import {
  createWalletSendError,
  ERROR_TRANSACTION_SIGNED_NOT_SUBMITTED,
  type WalletSendDiagnostics,
  WalletSendError,
} from './walletSendErrors'

export type WalletSendProgressPhase = 'wallet-approval' | 'sending-transaction'

export type WalletSendProgressReporter = {
  onPhaseStart?: (phase: WalletSendProgressPhase) => void
  onPhaseComplete?: (phase: WalletSendProgressPhase) => void
}

export type SendTransactionContext = TransactionContextSnapshot

export { TransactionSendError } from './transactionSimulation'
export { WalletSendError, type WalletSendDiagnostics } from './walletSendErrors'

export type WalletTransactionPayload = {
  wireBytes: Uint8Array
  wireInfo: TransactionWireInfo
  walletInput: ReturnType<typeof createInjectedWalletSerializeWrapper>
  walletInputType: WalletInputType
  wireByteLength: number
}

export type WalletSendResult = {
  signature: string
  walletMethod: string
  fallbackAttempted: boolean
  wireByteLength: number
  wireInfo: TransactionWireInfo
  diagnostics: WalletSendDiagnostics | null
}

function logTransactionDebug(stage: string, details: Record<string, unknown>): void {
  if (!isDevelopmentMode()) {
    return
  }

  console.info(`[CBS Locker TX] ${stage}`, serializeForDebug(details))
}

function buildWalletTransactionPayload(compiled: CompiledWalletTransaction): WalletTransactionPayload {
  const wireBytes = getTransactionWireBytes(compiled.unsignedTransaction)
  const wireInfo = createTransactionWireInfo(wireBytes)
  const walletInput = createInjectedWalletSerializeWrapper(wireBytes)

  return {
    wireBytes,
    wireInfo,
    walletInput,
    walletInputType: getWalletInputType(walletInput),
    wireByteLength: wireInfo.wireByteLength,
  }
}

function getWalletDebugContext(walletMethod: string, payload: WalletTransactionPayload) {
  const walletInfo = getConnectedWalletInfo()

  return {
    walletMethod,
    walletProviderName: walletInfo.name,
    walletProviderSource: walletInfo.source,
    walletInputType: payload.walletInputType,
    wireByteLength: payload.wireByteLength,
    transactionVersion: payload.wireInfo.messageVersion,
    deserializerPath: payload.wireInfo.deserializerPath,
    firstWireByte: payload.wireInfo.firstWireByte,
  }
}

function normalizeWalletSignature(signature: string): string {
  if (/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature)) {
    return signature
  }

  try {
    const bytes = Uint8Array.from(atob(signature), (char) => char.charCodeAt(0))

    if (bytes.length === 64) {
      return getBase58Decoder().decode(bytes)
    }
  } catch {
    // Fall through to the original signature string.
  }

  return signature
}

type WalletSendBoundaryError = Error & {
  walletMethod: string
  fallbackAttempted: boolean
  wireByteLength: number
  wireInfo: TransactionWireInfo | null
}

function createWalletSendBoundaryError(input: {
  cause: unknown
  walletMethod: string
  fallbackAttempted: boolean
  wireInfo: TransactionWireInfo
}): WalletSendBoundaryError {
  const message = input.cause instanceof Error ? input.cause.message : String(input.cause)
  const error = new Error(message) as WalletSendBoundaryError
  error.name = 'WalletSendBoundaryError'
  error.walletMethod = input.walletMethod
  error.fallbackAttempted = input.fallbackAttempted
  error.wireByteLength = input.wireInfo.wireByteLength
  error.wireInfo = input.wireInfo
  return error
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

type RpcConfirmationSnapshot = {
  confirmationStatus: string | null
  slot: string | null
  err: unknown | null
}

function resolveWalletSendStrategy(
  walletProvider: SolanaWalletProvider,
): 'signTransaction+rpcSend' | 'signAndSendTransaction' {
  const walletInfo = getConnectedWalletInfo()

  if (walletInfo.source === 'injected') {
    return 'signTransaction+rpcSend'
  }

  if (walletInfo.source === 'wallet-standard' && walletProvider.signAndSendTransaction) {
    return 'signAndSendTransaction'
  }

  if (walletProvider.signAndSendTransaction && !walletProvider.signTransaction) {
    return 'signAndSendTransaction'
  }

  return 'signTransaction+rpcSend'
}

function isVersionedDeserializeError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  const normalized = message.toLowerCase()
  return (
    normalized.includes('versioned messages must be deserialized') ||
    normalized.includes('versionedmessage.deserialize') ||
    normalized.includes('versionedtransaction')
  )
}

async function sendSignedTransactionViaRpc(signedBytes: Uint8Array): Promise<string> {
  const rpc = getSolanaRpc()
  const signedTransaction = decodeSignedWireTransaction(signedBytes)

  assertIsSendableTransaction(signedTransaction)

  const encoded = getBase64EncodedWireTransaction(signedTransaction)

  const rpcSendSignature = await rpc
    .sendTransaction(encoded, {
      encoding: 'base64',
      preflightCommitment: 'confirmed',
      skipPreflight: true,
    })
    .send()

  return String(rpcSendSignature)
}

async function pollInitialConfirmationStatus(signature: string): Promise<RpcConfirmationSnapshot> {
  const rpc = getSolanaRpc()
  assertIsSignature(signature)
  const signatureValue = signature

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { value } = await rpc
      .getSignatureStatuses([signatureValue], {
        searchTransactionHistory: attempt > 1,
      })
      .send()

    const status = value[0]

    if (status) {
      return {
        confirmationStatus: status.confirmationStatus ?? null,
        slot: status.slot != null ? String(status.slot) : null,
        err: status.err,
      }
    }

    if (attempt < 3) {
      await sleep(400)
    }
  }

  return {
    confirmationStatus: null,
    slot: null,
    err: null,
  }
}

function logWalletSendComplete(input: {
  walletMethod: string
  payload: WalletTransactionPayload
  signedTransactionBytes: number | null
  rpcSendSignature: string
  rpcSendResult: string
  confirmation: RpcConfirmationSnapshot
}): void {
  logTransactionDebug('wallet-sign-complete', {
    ...getWalletDebugContext(input.walletMethod, input.payload),
    walletMethod: input.walletMethod,
    signedTransactionBytes: input.signedTransactionBytes,
    rpcSendSignature: input.rpcSendSignature,
    rpcSendResult: input.rpcSendResult,
    confirmationStatus: input.confirmation.confirmationStatus,
    confirmationSlot: input.confirmation.slot,
    confirmationErr: input.confirmation.err,
  })
}

async function executeSignTransactionRpcSend(input: {
  walletProvider: SolanaWalletProvider
  payload: WalletTransactionPayload
  compiled: CompiledWalletTransaction
  walletSendProgress?: WalletSendProgressReporter
}): Promise<WalletSendResult> {
  const walletMethod = 'signTransaction+rpcSend'

  if (!input.walletProvider.signTransaction) {
    throw new Error('Wallet does not support signTransaction.')
  }

  if (!supportsSignTransactionRpcFallback(input.payload.wireInfo)) {
    throw new Error(
      'signTransaction + RPC send is only supported for legacy Solkit transactions.',
    )
  }

  logTransactionDebug('wallet-sign', {
    ...getWalletDebugContext(walletMethod, input.payload),
    blockhash: input.compiled.blockhash,
    lastValidBlockHeight: input.compiled.lastValidBlockHeight,
  })

  input.walletSendProgress?.onPhaseStart?.('wallet-approval')

  const signedResult = await input.walletProvider.signTransaction(input.payload.walletInput)
  const signedBytes = extractSignedWireBytes(signedResult)

  input.walletSendProgress?.onPhaseComplete?.('wallet-approval')
  input.walletSendProgress?.onPhaseStart?.('sending-transaction')

  let rpcSendSignature: string
  let rpcSendResult: string

  try {
    rpcSendSignature = await sendSignedTransactionViaRpc(signedBytes)
    rpcSendResult = 'accepted'
  } catch (rpcError) {
    const rpcMessage = rpcError instanceof Error ? rpcError.message : String(rpcError)
    throw createWalletSendBoundaryError({
      cause: new Error(`${ERROR_TRANSACTION_SIGNED_NOT_SUBMITTED} ${rpcMessage}`.trim()),
      walletMethod,
      fallbackAttempted: false,
      wireInfo: input.payload.wireInfo,
    })
  }

  const confirmation = await pollInitialConfirmationStatus(rpcSendSignature)

  input.walletSendProgress?.onPhaseComplete?.('sending-transaction')

  logWalletSendComplete({
    walletMethod,
    payload: input.payload,
    signedTransactionBytes: signedBytes.length,
    rpcSendSignature,
    rpcSendResult,
    confirmation,
  })

  return {
    signature: rpcSendSignature,
    walletMethod,
    fallbackAttempted: false,
    wireByteLength: input.payload.wireByteLength,
    wireInfo: input.payload.wireInfo,
    diagnostics: null,
  }
}

async function executeSignAndSendWalletTransaction(input: {
  walletProvider: SolanaWalletProvider
  payload: WalletTransactionPayload
  compiled: CompiledWalletTransaction
  walletSendProgress?: WalletSendProgressReporter
}): Promise<WalletSendResult> {
  const walletMethod = 'signAndSendTransaction'

  if (!input.walletProvider.signAndSendTransaction) {
    throw new Error('Wallet does not support signAndSendTransaction.')
  }

  logTransactionDebug('wallet-sign-and-send', {
    ...getWalletDebugContext(walletMethod, input.payload),
    blockhash: input.compiled.blockhash,
    lastValidBlockHeight: input.compiled.lastValidBlockHeight,
  })

  input.walletSendProgress?.onPhaseStart?.('wallet-approval')

  const result = await input.walletProvider.signAndSendTransaction(input.payload.walletInput)
  const rpcSendSignature = normalizeWalletSignature(result.signature)

  input.walletSendProgress?.onPhaseComplete?.('wallet-approval')
  input.walletSendProgress?.onPhaseStart?.('sending-transaction')

  const confirmation = await pollInitialConfirmationStatus(rpcSendSignature)

  input.walletSendProgress?.onPhaseComplete?.('sending-transaction')

  logWalletSendComplete({
    walletMethod,
    payload: input.payload,
    signedTransactionBytes: null,
    rpcSendSignature,
    rpcSendResult: 'wallet-submitted',
    confirmation,
  })

  return {
    signature: rpcSendSignature,
    walletMethod,
    fallbackAttempted: false,
    wireByteLength: input.payload.wireByteLength,
    wireInfo: input.payload.wireInfo,
    diagnostics: null,
  }
}

async function executeWalletSend(input: {
  walletProvider: SolanaWalletProvider
  compiled: CompiledWalletTransaction
  simulationCompletedAtMs?: number | null
  walletSendProgress?: WalletSendProgressReporter
}): Promise<WalletSendResult> {
  const walletSendStartedAtMs = Date.now()
  const payload = buildWalletTransactionPayload(input.compiled)
  const strategy = resolveWalletSendStrategy(input.walletProvider)

  logBlockhashLifecycle('wallet-send-start', input.compiled.lifecycle, {
    msSinceBlockhashFetch: Math.max(0, walletSendStartedAtMs - input.compiled.blockhashInfo.fetchedAtMs),
    msSinceSimulation:
      input.simulationCompletedAtMs == null
        ? null
        : Math.max(0, walletSendStartedAtMs - input.simulationCompletedAtMs),
    wireByteLength: payload.wireByteLength,
    transactionVersion: payload.wireInfo.messageVersion,
    deserializerPath: payload.wireInfo.deserializerPath,
    walletSendStrategy: strategy,
  })

  try {
    if (strategy === 'signAndSendTransaction') {
      return await executeSignAndSendWalletTransaction({
        walletProvider: input.walletProvider,
        payload,
        compiled: input.compiled,
        walletSendProgress: input.walletSendProgress,
      })
    }

    return await executeSignTransactionRpcSend({
      walletProvider: input.walletProvider,
      payload,
      compiled: input.compiled,
      walletSendProgress: input.walletSendProgress,
    })
  } catch (error) {
    if (isVersionedDeserializeError(error) && strategy === 'signAndSendTransaction') {
      throw createWalletSendBoundaryError({
        cause: new Error(
          'Wallet could not submit the transaction. The wallet rejected the Solkit wire bytes format. Try another wallet or reconnect.',
        ),
        walletMethod: 'signAndSendTransaction',
        fallbackAttempted: false,
        wireInfo: payload.wireInfo,
      })
    }

    if (error instanceof Error && error.name === 'WalletSendBoundaryError') {
      throw error
    }

    throw createWalletSendBoundaryError({
      cause: error,
      walletMethod: strategy,
      fallbackAttempted: false,
      wireInfo: payload.wireInfo,
    })
  }
}

async function ensureFreshCompiledTransaction(input: {
  walletAddress: string
  instructions: Instruction[]
  simulationCompletedAtMs?: number | null
  reason: string
}): Promise<CompiledWalletTransaction> {
  const walletCompileStartedAtMs = Date.now()
  let compiled = await compileWalletTransaction({
    walletAddress: input.walletAddress,
    instructions: input.instructions,
    referenceTimeMs: walletCompileStartedAtMs,
  })

  const msSinceSimulation =
    input.simulationCompletedAtMs == null
      ? null
      : Math.max(0, walletCompileStartedAtMs - input.simulationCompletedAtMs)

  logBlockhashLifecycle('wallet-compile', compiled.lifecycle, {
    reason: input.reason,
    msSinceSimulation,
  })

  const stillValid = await isCompiledBlockhashStillValid({
    lastValidBlockHeight: compiled.lastValidBlockHeight,
  })

  if (!stillValid) {
    logBlockhashLifecycle('wallet-recompile-expired', compiled.lifecycle, {
      reason: 'lastValidBlockHeight exceeded before wallet send',
      msSinceSimulation,
    })

    const recompileStartedAtMs = Date.now()
    compiled = await compileWalletTransaction({
      walletAddress: input.walletAddress,
      instructions: input.instructions,
      referenceTimeMs: recompileStartedAtMs,
    })

    logBlockhashLifecycle('wallet-compile-refreshed', compiled.lifecycle, {
      reason: 'blockhash expired before wallet send',
      msSinceSimulation,
    })
  }

  return compiled
}

async function throwWalletBoundaryError(input: {
  error: unknown
  compiled: CompiledWalletTransaction
  context: TransactionContextSnapshot | null
  simulationPassed: boolean
  priorSimulationDiagnostics: SimulationDiagnostics | null
  walletMethod: string | null
  fallbackAttempted: boolean
  wireByteLength: number | null
  wireInfo: TransactionWireInfo | null
  walletInputType?: WalletInputType | null
}): Promise<never> {
  const walletInfo = getConnectedWalletInfo()

  if (input.simulationPassed) {
    throw createWalletSendError({
      walletError: input.error,
      simulationPassed: true,
      walletMethod: input.walletMethod,
      fallbackAttempted: input.fallbackAttempted,
      wireByteLength: input.wireByteLength,
      transactionWireInfo: input.wireInfo,
      walletInputType: input.walletInputType ?? 'serialize-wrapper',
      walletProviderName: walletInfo.name,
      blockhashLifecycle: input.compiled.lifecycle,
      priorSimulationDiagnostics: input.priorSimulationDiagnostics,
    })
  }

  throw await enrichWalletFailureWithSimulation(
    input.error,
    input.compiled.unsignedTransaction,
    input.context,
    input.compiled,
  )
}

export async function sendInstructionsWithWallet(input: {
  walletAddress: string
  walletProvider: SolanaWalletProvider
  instructions: Instruction[]
  transactionContext?: SendTransactionContext | null
  skipPreflightSimulation?: boolean
  simulationCompletedAtMs?: number | null
  simulationPassed?: boolean
  priorSimulationDiagnostics?: SimulationDiagnostics | null
  walletSendProgress?: WalletSendProgressReporter
}): Promise<string> {
  if (!input.walletProvider.signTransaction && !input.walletProvider.signAndSendTransaction) {
    throw new Error('Wallet does not support transaction signing.')
  }

  const context = input.transactionContext ?? null
  const simulationPassed = input.simulationPassed === true

  try {
    logTransactionDebug('start', {
      walletAddress: input.walletAddress,
      instructionCount: input.instructions.length,
      transactionContext: context,
      simulationCompletedAtMs: input.simulationCompletedAtMs ?? null,
      simulationPassed,
    })

    let compiled = await ensureFreshCompiledTransaction({
      walletAddress: input.walletAddress,
      instructions: input.instructions,
      simulationCompletedAtMs: input.simulationCompletedAtMs ?? null,
      reason: 'wallet-send',
    })

    const preparedPayload = buildWalletTransactionPayload(compiled)

    logTransactionDebug('compiled', {
      blockhash: compiled.blockhash,
      lastValidBlockHeight: compiled.lastValidBlockHeight,
      transactionContext: context,
      ...getWalletDebugContext('compile', preparedPayload),
    })

    if (!input.skipPreflightSimulation) {
      await simulateCompiledTransactionStrict({
        unsignedTransaction: compiled.unsignedTransaction,
        compiled,
        context,
        source: 'rpc-simulation',
      })
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const walletResult = await executeWalletSend({
          walletProvider: input.walletProvider,
          compiled,
          simulationCompletedAtMs: input.simulationCompletedAtMs ?? null,
          walletSendProgress: input.walletSendProgress,
        })

        return walletResult.signature
      } catch (walletError) {
        if (isBlockhashNotFoundError(walletError) && attempt === 0) {
          logBlockhashLifecycle('wallet-retry-blockhash', compiled.lifecycle, {
            reason: 'BlockhashNotFound during wallet send',
          })

          compiled = await ensureFreshCompiledTransaction({
            walletAddress: input.walletAddress,
            instructions: input.instructions,
            simulationCompletedAtMs: input.simulationCompletedAtMs ?? null,
            reason: 'wallet-send-retry',
          })

          continue
        }

        const boundaryError = walletError as WalletSendBoundaryError
        const payload = buildWalletTransactionPayload(compiled)

        await throwWalletBoundaryError({
          error: walletError,
          compiled,
          context,
          simulationPassed,
          priorSimulationDiagnostics: input.priorSimulationDiagnostics ?? null,
          walletMethod:
            boundaryError.walletMethod ??
            (input.walletProvider.signAndSendTransaction
              ? 'signAndSendTransaction'
              : 'signTransaction+rpcSend'),
          fallbackAttempted: boundaryError.fallbackAttempted ?? false,
          wireByteLength: boundaryError.wireByteLength ?? payload.wireByteLength,
          wireInfo: boundaryError.wireInfo ?? payload.wireInfo,
          walletInputType: payload.walletInputType,
        })
      }
    }

    throw new Error('Wallet send failed after refreshing the blockhash.')
  } catch (error) {
    if (error instanceof WalletSendError || error instanceof TransactionSendError) {
      throw error
    }

    logTransactionDebug('failed', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      transactionContext: context,
      simulationPassed,
    })

    throw new Error(formatLockerError(error, getSelectedClusterLabel()))
  }
}

export async function simulateInstructionsWithDiagnostics(input: {
  walletAddress: string
  instructions: Instruction[]
  context: TransactionContextSnapshot | null
}): Promise<{
  diagnostics: SimulationDiagnostics | null
  simulationCompletedAtMs: number
  retriedForBlockhash: boolean
  blockhashLifecycle: BlockhashLifecycleSnapshot | null
}> {
  const result = await simulateInstructionsWithFreshBlockhash({
    walletAddress: input.walletAddress,
    instructions: input.instructions,
    context: input.context,
    source: 'rpc-simulation',
  })

  return {
    diagnostics: result.diagnostics,
    simulationCompletedAtMs: result.simulationCompletedAtMs,
    retriedForBlockhash: result.retriedForBlockhash,
    blockhashLifecycle: result.compiled.lifecycle,
  }
}
