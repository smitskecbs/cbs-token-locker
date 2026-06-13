import {
  address,
  compileTransaction,
  createTransactionMessage,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  type Instruction,
} from '@solana/kit'

import {
  BLOCKHASH_EXPIRED_USER_MESSAGE,
  createBlockhashLifecycleSnapshot,
  fetchFreshBlockhashInfo,
  isBlockhashNotFoundError,
  logBlockhashLifecycle,
  type BlockhashLifecycleSnapshot,
  type FreshBlockhashInfo,
} from './blockhashLifecycle'
import {
  getTransactionWireBase64,
  WALLET_TRANSACTION_MESSAGE_VERSION,
} from './transactionWire'
import { isDevelopmentMode } from '../state/debugStore'
import { serializeForDebug } from '../utils/safeSerialize'
import { getSolanaRpc } from './rpc'
import {
  buildSimulationDiagnostics,
  buildWalletFailureDiagnostics,
  type SimulationDiagnostics,
  type TransactionContextSnapshot,
} from './simulationDiagnostics'

export class TransactionSendError extends Error {
  readonly diagnostics: SimulationDiagnostics

  constructor(message: string, diagnostics: SimulationDiagnostics) {
    super(message)
    this.name = 'TransactionSendError'
    this.diagnostics = diagnostics
  }
}

export type CompiledWalletTransaction = {
  unsignedTransaction: ReturnType<typeof compileTransaction>
  blockhash: string
  lastValidBlockHeight: bigint
  blockhashInfo: FreshBlockhashInfo
  lifecycle: BlockhashLifecycleSnapshot
}

type RpcSimulationResult = {
  err: unknown
  logs: string[]
  unitsConsumed?: bigint | number | null
}

export type SimulationAttemptResult = {
  diagnostics: SimulationDiagnostics | null
  compiled: CompiledWalletTransaction
  simulationCompletedAtMs: number
  retriedForBlockhash: boolean
}

function logSimulationDebug(stage: string, details: Record<string, unknown>): void {
  if (!isDevelopmentMode()) {
    return
  }

  console.info(`[CBS Locker TX] ${stage}`, serializeForDebug(details))

  if (Array.isArray(details.logs) && details.logs.length > 0) {
    console.info(`[CBS Locker TX] ${stage} — program logs:\n${details.logs.join('\n')}`)
  }
}

function buildCompiledWalletTransaction(input: {
  walletAddress: string
  instructions: Instruction[]
  blockhashInfo: FreshBlockhashInfo
  referenceTimeMs?: number
}): CompiledWalletTransaction {
  const transactionMessage = pipe(
    createTransactionMessage({ version: WALLET_TRANSACTION_MESSAGE_VERSION }),
    (message) => setTransactionMessageFeePayer(address(input.walletAddress), message),
    (message) =>
      setTransactionMessageLifetimeUsingBlockhash(
        {
          blockhash: input.blockhashInfo.blockhash,
          lastValidBlockHeight: input.blockhashInfo.lastValidBlockHeight,
        },
        message,
      ),
    (message) => appendTransactionMessageInstructions(input.instructions, message),
  )

  const lifecycle = createBlockhashLifecycleSnapshot({
    blockhash: input.blockhashInfo.blockhash,
    lastValidBlockHeight: input.blockhashInfo.lastValidBlockHeight,
    currentBlockHeight: input.blockhashInfo.currentBlockHeight,
    fetchedAtMs: input.blockhashInfo.fetchedAtMs,
    referenceTimeMs: input.referenceTimeMs,
  })

  return {
    unsignedTransaction: compileTransaction(transactionMessage),
    blockhash: String(input.blockhashInfo.blockhash),
    lastValidBlockHeight: input.blockhashInfo.lastValidBlockHeight,
    blockhashInfo: input.blockhashInfo,
    lifecycle,
  }
}

export async function compileWalletTransaction(input: {
  walletAddress: string
  instructions: Instruction[]
  referenceTimeMs?: number
}): Promise<CompiledWalletTransaction> {
  const blockhashInfo = await fetchFreshBlockhashInfo()
  const compiled = buildCompiledWalletTransaction({
    walletAddress: input.walletAddress,
    instructions: input.instructions,
    blockhashInfo,
    referenceTimeMs: input.referenceTimeMs,
  })

  logBlockhashLifecycle('compiled', compiled.lifecycle, {
    walletAddress: input.walletAddress,
    instructionCount: input.instructions.length,
  })

  return compiled
}

export async function runRpcSimulation(
  unsignedTransaction: ReturnType<typeof compileTransaction>,
): Promise<RpcSimulationResult> {
  const rpc = getSolanaRpc()
  const encodedUnsigned = getTransactionWireBase64(unsignedTransaction)
  const simulation = await rpc
    .simulateTransaction(encodedUnsigned, {
      encoding: 'base64',
      commitment: 'confirmed',
      sigVerify: false,
    })
    .send()

  return {
    err: simulation.value.err,
    logs: simulation.value.logs ?? [],
    unitsConsumed: simulation.value.unitsConsumed ?? null,
  }
}

export function createSimulationFailure(
  rpcError: unknown,
  logs: string[],
  context: TransactionContextSnapshot | null,
  source: SimulationDiagnostics['source'],
  walletMessage?: string | null,
  blockhashLifecycle?: BlockhashLifecycleSnapshot | null,
  retriedForBlockhash = false,
): TransactionSendError {
  const diagnostics = buildSimulationDiagnostics({
    rpcError,
    logs,
    context,
    source,
    walletMessage: walletMessage ?? null,
    blockhashLifecycle: blockhashLifecycle ?? null,
  })

  const message =
    isBlockhashNotFoundError(rpcError) && retriedForBlockhash
      ? BLOCKHASH_EXPIRED_USER_MESSAGE
      : diagnostics.summary

  logSimulationDebug('simulation-failed', {
    error: rpcError,
    logs,
    retriedForBlockhash,
    blockhashLifecycle,
    diagnostics: serializeForDebug(diagnostics),
  })

  if (isDevelopmentMode()) {
    console.error(`[CBS Locker TX] full simulation report:\n${diagnostics.fullText}`)
  }

  return new TransactionSendError(message, {
    ...diagnostics,
    summary: message,
  })
}

export async function simulateCompiledTransactionStrict(input: {
  unsignedTransaction: ReturnType<typeof compileTransaction>
  compiled?: CompiledWalletTransaction | null
  context: TransactionContextSnapshot | null
  source?: SimulationDiagnostics['source']
  retriedForBlockhash?: boolean
}): Promise<SimulationDiagnostics | null> {
  const simulationStartedAtMs = Date.now()
  const compiled = input.compiled ?? null

  if (compiled) {
    logBlockhashLifecycle('simulate-start', compiled.lifecycle, {
      msSinceBlockhashFetch: Math.max(0, simulationStartedAtMs - compiled.blockhashInfo.fetchedAtMs),
    })
  }

  const simulation = await runRpcSimulation(input.unsignedTransaction)

  if (simulation.err) {
    throw createSimulationFailure(
      simulation.err,
      simulation.logs,
      input.context,
      input.source ?? 'rpc-simulation',
      undefined,
      compiled?.lifecycle ?? null,
      input.retriedForBlockhash ?? false,
    )
  }

  logSimulationDebug('simulation-passed', {
    unitsConsumed: simulation.unitsConsumed ?? null,
    logs: simulation.logs,
    blockhashLifecycle: compiled?.lifecycle ?? null,
    msSinceBlockhashFetch: compiled
      ? Math.max(0, simulationStartedAtMs - compiled.blockhashInfo.fetchedAtMs)
      : null,
  })

  if (isDevelopmentMode() && simulation.logs.length > 0) {
    console.info(`[CBS Locker TX] simulation-passed — program logs:\n${simulation.logs.join('\n')}`)
  }

  return buildSimulationDiagnostics({
    rpcError: null,
    logs: simulation.logs,
    context: input.context,
    source: input.source ?? 'rpc-simulation',
    blockhashLifecycle: compiled?.lifecycle ?? null,
  })
}

function resolveSimulationRpcError(error: unknown): unknown {
  if (error instanceof TransactionSendError) {
    return error.diagnostics.simulationErrorRaw ?? error
  }

  return error
}

export async function simulateInstructionsWithFreshBlockhash(input: {
  walletAddress: string
  instructions: Instruction[]
  context: TransactionContextSnapshot | null
  source?: SimulationDiagnostics['source']
}): Promise<SimulationAttemptResult> {
  let retriedForBlockhash = false

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const compileStartedAtMs = Date.now()
    const compiled = await compileWalletTransaction({
      walletAddress: input.walletAddress,
      instructions: input.instructions,
      referenceTimeMs: compileStartedAtMs,
    })

    logBlockhashLifecycle('simulate-compile', compiled.lifecycle, {
      attempt: attempt + 1,
      msSinceBlockhashFetch: 0,
    })

    try {
      const diagnostics = await simulateCompiledTransactionStrict({
        unsignedTransaction: compiled.unsignedTransaction,
        compiled,
        context: input.context,
        source: input.source,
        retriedForBlockhash,
      })

      return {
        diagnostics,
        compiled,
        simulationCompletedAtMs: Date.now(),
        retriedForBlockhash,
      }
    } catch (error) {
      const rpcError = resolveSimulationRpcError(error)

      if (isBlockhashNotFoundError(rpcError) && attempt === 0) {
        retriedForBlockhash = true
        logBlockhashLifecycle('simulate-retry-blockhash', compiled.lifecycle, {
          reason: 'BlockhashNotFound',
        })
        continue
      }

      if (error instanceof TransactionSendError && isBlockhashNotFoundError(rpcError)) {
        throw new TransactionSendError(BLOCKHASH_EXPIRED_USER_MESSAGE, {
          ...error.diagnostics,
          summary: BLOCKHASH_EXPIRED_USER_MESSAGE,
        })
      }

      throw error
    }
  }

  throw new TransactionSendError(
    BLOCKHASH_EXPIRED_USER_MESSAGE,
    buildSimulationDiagnostics({
      rpcError: { BlockhashNotFound: null },
      logs: [],
      context: input.context,
      source: input.source ?? 'rpc-simulation',
    }),
  )
}

export async function simulateInstructionsStrict(input: {
  walletAddress: string
  instructions: Instruction[]
  context: TransactionContextSnapshot | null
  source?: SimulationDiagnostics['source']
}): Promise<SimulationDiagnostics | null> {
  const result = await simulateInstructionsWithFreshBlockhash(input)
  return result.diagnostics
}

export async function enrichWalletFailureWithSimulation(
  error: unknown,
  unsignedTransaction: ReturnType<typeof compileTransaction>,
  context: TransactionContextSnapshot | null,
  compiled?: CompiledWalletTransaction | null,
): Promise<TransactionSendError> {
  const walletMessage = error instanceof Error ? error.message : String(error)

  if (isBlockhashNotFoundError(error) || isBlockhashNotFoundError(walletMessage)) {
    const diagnostics = buildWalletFailureDiagnostics({
      walletMessage,
      logs: [],
      context,
      rpcError: { BlockhashNotFound: null },
      blockhashLifecycle: compiled?.lifecycle ?? null,
    })

    return new TransactionSendError(BLOCKHASH_EXPIRED_USER_MESSAGE, {
      ...diagnostics,
      summary: BLOCKHASH_EXPIRED_USER_MESSAGE,
    })
  }

  try {
    const simulation = await runRpcSimulation(unsignedTransaction)
    const diagnostics = buildWalletFailureDiagnostics({
      walletMessage,
      logs: simulation.logs,
      context,
      rpcError: simulation.err ?? { walletMessage },
      blockhashLifecycle: compiled?.lifecycle ?? null,
    })

    if (isBlockhashNotFoundError(simulation.err)) {
      return new TransactionSendError(BLOCKHASH_EXPIRED_USER_MESSAGE, {
        ...diagnostics,
        summary: BLOCKHASH_EXPIRED_USER_MESSAGE,
      })
    }

    logSimulationDebug('wallet-failure-with-simulation', {
      walletMessage,
      logs: simulation.logs,
      blockhashLifecycle: compiled?.lifecycle ?? null,
      diagnostics: serializeForDebug(diagnostics),
    })

    if (isDevelopmentMode()) {
      console.error(`[CBS Locker TX] wallet failure report:\n${diagnostics.fullText}`)
    }

    return new TransactionSendError(diagnostics.summary, diagnostics)
  } catch (simulationError) {
    if (simulationError instanceof TransactionSendError) {
      return simulationError
    }

    const diagnostics = buildWalletFailureDiagnostics({
      walletMessage,
      logs: [],
      context,
      rpcError: { walletMessage },
      blockhashLifecycle: compiled?.lifecycle ?? null,
    })

    return new TransactionSendError(diagnostics.summary, diagnostics)
  }
}
