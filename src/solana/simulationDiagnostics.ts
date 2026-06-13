import { resolveLockerAnchorError } from './anchorErrors'
import { safeJsonStringify } from '../utils/safeSerialize'
import type { BlockhashLifecycleSnapshot } from './blockhashLifecycle'

export type TransactionContextSnapshot = {
  lockPda: string
  vaultPda: string
  ownerTokenAccount: string
  ownerWallet: string
  mint: string
  unlockTimestamp: string
  amount: string
  lockSeed: string
}

export type SimulationDiagnostics = {
  summary: string
  simulationErrorRaw: string | null
  instructionIndex: number | null
  anchorErrorCode: number | null
  anchorErrorName: string | null
  anchorErrorMessage: string | null
  customProgramError: number | null
  accountValidationFailure: string | null
  programLogs: string[]
  transactionContext: TransactionContextSnapshot | null
  blockhashLifecycle: BlockhashLifecycleSnapshot | null
  fullText: string
  source: 'rpc-simulation' | 'wallet' | 'unknown'
}

type ParsedRpcError = {
  instructionIndex: number | null
  customProgramError: number | null
  accountValidationFailure: string | null
  anchorErrorCode: number | null
  anchorErrorName: string | null
  anchorErrorMessage: string | null
}

function parseInstructionDetail(detail: unknown): Partial<ParsedRpcError> {
  if (typeof detail === 'string') {
    return {
      accountValidationFailure: detail,
    }
  }

  if (!detail || typeof detail !== 'object') {
    return {}
  }

  if ('Custom' in detail && typeof (detail as { Custom: unknown }).Custom === 'number') {
    const code = (detail as { Custom: number }).Custom
    const anchor = resolveLockerAnchorError(code)

    return {
      customProgramError: code,
      anchorErrorCode: code,
      anchorErrorName: anchor.name,
      anchorErrorMessage: anchor.message,
    }
  }

  const keys = Object.keys(detail)

  if (keys.length === 1) {
    return {
      accountValidationFailure: `${keys[0]}: ${safeJsonStringify((detail as Record<string, unknown>)[keys[0]!])}`,
    }
  }

  return {
    accountValidationFailure: safeJsonStringify(detail),
  }
}

export function parseRpcSimulationError(error: unknown): ParsedRpcError {
  const parsed: ParsedRpcError = {
    instructionIndex: null,
    customProgramError: null,
    accountValidationFailure: null,
    anchorErrorCode: null,
    anchorErrorName: null,
    anchorErrorMessage: null,
  }

  if (!error || typeof error !== 'object') {
    return parsed
  }

  if ('InstructionError' in error && Array.isArray((error as { InstructionError: unknown[] }).InstructionError)) {
    const [index, detail] = (error as { InstructionError: [number, unknown] }).InstructionError
    parsed.instructionIndex = index

    Object.assign(parsed, parseInstructionDetail(detail))
    return parsed
  }

  const entries = Object.entries(error as Record<string, unknown>)

  if (entries.length === 1) {
    const [key, value] = entries[0]!

    if (key === 'InstructionError' && Array.isArray(value) && value.length >= 2) {
      parsed.instructionIndex = Number(value[0])
      Object.assign(parsed, parseInstructionDetail(value[1]))
      return parsed
    }

    parsed.accountValidationFailure = `${key}: ${safeJsonStringify(value)}`
  }

  return parsed
}

export function enrichDiagnosticsFromLogs(
  diagnostics: ParsedRpcError,
  logs: string[],
): ParsedRpcError {
  const enriched = { ...diagnostics }

  for (const line of logs) {
    const anchorLog = line.match(/Error Code: ([A-Za-z0-9_]+)\. Error Number: (\d+)/)

    if (anchorLog) {
      const code = Number(anchorLog[2])
      const anchor = resolveLockerAnchorError(code)

      enriched.anchorErrorCode = code
      enriched.anchorErrorName = anchorLog[1] ?? anchor.name
      enriched.anchorErrorMessage = anchor.message
      enriched.customProgramError = code
    }

    const customHex = line.match(/custom program error: (0x[0-9a-f]+)/i)

    if (customHex) {
      const code = Number.parseInt(customHex[1]!, 16)
      const anchor = resolveLockerAnchorError(code)

      enriched.customProgramError = code
      enriched.anchorErrorCode = code
      enriched.anchorErrorName = anchor.name ?? enriched.anchorErrorName
      enriched.anchorErrorMessage = anchor.message ?? enriched.anchorErrorMessage
    }

    const accountCause = line.match(/caused by account: ([a-zA-Z0-9_]+)/)

    if (accountCause) {
      enriched.accountValidationFailure = `Account: ${accountCause[1]}`
    }

    const constraint = line.match(/Constraint[:\s]+([A-Za-z0-9_]+)/)

    if (constraint) {
      enriched.accountValidationFailure = enriched.accountValidationFailure
        ? `${enriched.accountValidationFailure}; Constraint: ${constraint[1]}`
        : `Constraint: ${constraint[1]}`
    }
  }

  return enriched
}

export function buildSimulationSummary(parsed: ParsedRpcError, logs: string[]): string {
  const parts: string[] = []

  if (parsed.instructionIndex !== null) {
    parts.push(`Instruction index: ${parsed.instructionIndex}`)
  }

  if (parsed.anchorErrorName) {
    parts.push(`Anchor error: ${parsed.anchorErrorName} (${parsed.anchorErrorCode})`)
  } else if (parsed.customProgramError !== null) {
    parts.push(`Custom program error: ${parsed.customProgramError}`)
  }

  if (parsed.anchorErrorMessage) {
    parts.push(parsed.anchorErrorMessage)
  }

  if (parsed.accountValidationFailure) {
    parts.push(`Account validation: ${parsed.accountValidationFailure}`)
  }

  const failedLog = logs.find((line) => {
    return line.includes('failed') || line.includes('Error') || line.includes('AnchorError')
  })

  if (failedLog && parts.length === 0) {
    parts.push(failedLog)
  }

  return parts.join(' · ') || 'Transaction simulation failed.'
}

function formatBlockhashLifecycleBlock(
  blockhashLifecycle: BlockhashLifecycleSnapshot | null | undefined,
): string[] {
  if (!blockhashLifecycle) {
    return ['Blockhash lifecycle: (not available)']
  }

  return [
    'Blockhash lifecycle:',
    `  Blockhash: ${blockhashLifecycle.blockhash}`,
    `  Last valid block height: ${blockhashLifecycle.lastValidBlockHeight}`,
    `  Current block height: ${blockhashLifecycle.currentBlockHeight ?? 'n/a'}`,
    `  Blockhash fetched at (ms): ${blockhashLifecycle.blockhashFetchedAtMs}`,
    `  Ms since blockhash fetch: ${blockhashLifecycle.msSinceBlockhashFetch ?? 'n/a'}`,
  ]
}

function formatContextBlock(context: TransactionContextSnapshot | null): string {
  if (!context) {
    return 'Transaction context: (not available)'
  }

  return [
    'Transaction context:',
    `  Lock PDA: ${context.lockPda}`,
    `  Vault PDA: ${context.vaultPda}`,
    `  Owner token account: ${context.ownerTokenAccount}`,
    `  Owner wallet: ${context.ownerWallet}`,
    `  Mint: ${context.mint}`,
    `  Unlock timestamp: ${context.unlockTimestamp}`,
    `  Amount (raw): ${context.amount}`,
    `  Lock seed: ${context.lockSeed}`,
  ].join('\n')
}

export function buildSimulationDiagnostics(input: {
  rpcError: unknown
  logs: string[]
  context: TransactionContextSnapshot | null
  source: SimulationDiagnostics['source']
  walletMessage?: string | null
  blockhashLifecycle?: BlockhashLifecycleSnapshot | null
}): SimulationDiagnostics {
  const parsed = enrichDiagnosticsFromLogs(parseRpcSimulationError(input.rpcError), input.logs)
  const summary = input.walletMessage
    ? `${input.walletMessage} ${buildSimulationSummary(parsed, input.logs)}`
    : buildSimulationSummary(parsed, input.logs)

  const lines = [
    `Simulation source: ${input.source}`,
    `Summary: ${summary}`,
    '',
    ...formatBlockhashLifecycleBlock(input.blockhashLifecycle),
    '',
    formatContextBlock(input.context),
    '',
    'Simulation error (RPC):',
    safeJsonStringify(input.rpcError),
    '',
    'Parsed details:',
    `  Instruction index: ${parsed.instructionIndex ?? 'n/a'}`,
    `  Anchor error code: ${parsed.anchorErrorCode ?? 'n/a'}`,
    `  Anchor error name: ${parsed.anchorErrorName ?? 'n/a'}`,
    `  Anchor error message: ${parsed.anchorErrorMessage ?? 'n/a'}`,
    `  Custom program error: ${parsed.customProgramError ?? 'n/a'}`,
    `  Account validation failure: ${parsed.accountValidationFailure ?? 'n/a'}`,
    '',
    'Program logs:',
    ...(input.logs.length > 0 ? input.logs : ['(no logs returned)']),
  ]

  return {
    summary,
    simulationErrorRaw: safeJsonStringify(input.rpcError),
    instructionIndex: parsed.instructionIndex,
    anchorErrorCode: parsed.anchorErrorCode,
    anchorErrorName: parsed.anchorErrorName,
    anchorErrorMessage: parsed.anchorErrorMessage,
    customProgramError: parsed.customProgramError,
    accountValidationFailure: parsed.accountValidationFailure,
    programLogs: [...input.logs],
    transactionContext: input.context,
    blockhashLifecycle: input.blockhashLifecycle ?? null,
    fullText: lines.join('\n'),
    source: input.source,
  }
}

export function buildWalletFailureDiagnostics(input: {
  walletMessage: string
  logs: string[]
  context: TransactionContextSnapshot | null
  rpcError?: unknown
  blockhashLifecycle?: BlockhashLifecycleSnapshot | null
}): SimulationDiagnostics {
  return buildSimulationDiagnostics({
    rpcError: input.rpcError ?? { walletMessage: input.walletMessage },
    logs: input.logs,
    context: input.context,
    source: 'wallet',
    walletMessage: input.walletMessage,
    blockhashLifecycle: input.blockhashLifecycle ?? null,
  })
}
