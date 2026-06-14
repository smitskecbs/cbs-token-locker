import { address, fetchEncodedAccount } from '@solana/kit'

import type { LockRecord } from '../types/lock'
import { safeJsonStringify } from '../utils/safeSerialize'
import { parseTokenLockAccount, type OnChainTokenLock } from './layout'
import { CBS_LOCKER_PROGRAM_ID } from './programId'
import { findLockAccountAddress } from './pda'
import { getSolanaRpc } from './rpc'
import { toLockRecord } from './fetchLock'
import { verifyOnChainLock } from './verify'

export type LockFetchFailureReason =
  | 'account_not_found'
  | 'wrong_pda'
  | 'wrong_owner'
  | 'deserialization_failure'

export type LockFetchDiagnostics = {
  stage: string
  attempt: number
  lockPda: string
  vaultPda: string
  signature: string
  accountExists: boolean
  programOwner: string | null
  expectedProgramId: string
  parsedOwner: string | null
  expectedOwner: string | null
  parsedVault: string | null
  failureReason: LockFetchFailureReason | null
  failureDetail: string | null
  strictVerification: {
    verified: boolean
    reason: string
  } | null
  confirmationStatus: string | null
  parsedLock: OnChainTokenLock | null
}

export function printLockVerificationDiagnostics(diagnostics: LockFetchDiagnostics): void {
  console.info('[CBS Locker] verification diagnostics', safeJsonStringify(diagnostics))
}

export function isLockAccountResolvable(diagnostics: LockFetchDiagnostics): boolean {
  return (
    diagnostics.accountExists &&
    diagnostics.failureReason === null &&
    diagnostics.parsedLock !== null
  )
}

export function lockRecordFromDiagnostics(
  lockPda: string,
  diagnostics: LockFetchDiagnostics,
  createSignature?: string,
): LockRecord | null {
  if (!diagnostics.parsedLock) {
    return null
  }

  const verification = diagnostics.strictVerification ?? {
    verified: false,
    reason: 'Strict verification was not run.',
  }

  return toLockRecord(address(lockPda), diagnostics.parsedLock, verification, createSignature)
}

export async function inspectLockAccountAtPda(input: {
  lockPda: string
  vaultPda: string
  signature: string
  expectedOwner?: string
  stage: string
  attempt?: number
  confirmationStatus?: string | null
}): Promise<LockFetchDiagnostics> {
  const rpc = getSolanaRpc()
  const lockAccount = address(input.lockPda)
  const encodedAccount = await fetchEncodedAccount(rpc, lockAccount)

  const diagnostics: LockFetchDiagnostics = {
    stage: input.stage,
    attempt: input.attempt ?? 1,
    lockPda: input.lockPda,
    vaultPda: input.vaultPda,
    signature: input.signature,
    accountExists: encodedAccount.exists,
    programOwner: encodedAccount.exists ? encodedAccount.programAddress : null,
    expectedProgramId: CBS_LOCKER_PROGRAM_ID,
    parsedOwner: null,
    expectedOwner: input.expectedOwner ?? null,
    parsedVault: null,
    failureReason: null,
    failureDetail: null,
    strictVerification: null,
    confirmationStatus: input.confirmationStatus ?? null,
    parsedLock: null,
  }

  if (!encodedAccount.exists) {
    diagnostics.failureReason = 'account_not_found'
    diagnostics.failureDetail = 'RPC returned no account at the lock PDA.'
    printLockVerificationDiagnostics(diagnostics)
    return diagnostics
  }

  if (encodedAccount.programAddress !== CBS_LOCKER_PROGRAM_ID) {
    diagnostics.failureReason = 'wrong_pda'
    diagnostics.failureDetail = `Account owner is ${encodedAccount.programAddress}, expected ${CBS_LOCKER_PROGRAM_ID}.`
    printLockVerificationDiagnostics(diagnostics)
    return diagnostics
  }

  const parsed = parseTokenLockAccount(encodedAccount.data)

  if (!parsed) {
    diagnostics.failureReason = 'deserialization_failure'
    diagnostics.failureDetail = 'Lock account data does not match the CBS Token Locker layout.'
    printLockVerificationDiagnostics(diagnostics)
    return diagnostics
  }

  diagnostics.parsedLock = parsed
  diagnostics.parsedOwner = parsed.owner
  diagnostics.parsedVault = parsed.vault

  if (input.expectedOwner && parsed.owner !== input.expectedOwner) {
    diagnostics.failureReason = 'wrong_owner'
    diagnostics.failureDetail = `Parsed owner ${parsed.owner} does not match expected wallet ${input.expectedOwner}.`
    printLockVerificationDiagnostics(diagnostics)
    return diagnostics
  }

  const [expectedLockAccount] = await findLockAccountAddress(
    address(parsed.owner),
    address(parsed.mint),
    parsed.lockSeed,
  )

  if (expectedLockAccount !== lockAccount) {
    diagnostics.failureReason = 'wrong_pda'
    diagnostics.failureDetail = `Lock PDA ${input.lockPda} does not match deterministic seeds for owner/mint/lockSeed.`
    printLockVerificationDiagnostics(diagnostics)
    return diagnostics
  }

  if (parsed.vault !== input.vaultPda) {
    diagnostics.failureReason = 'wrong_pda'
    diagnostics.failureDetail = `Vault in account ${parsed.vault} does not match expected vault PDA ${input.vaultPda}.`
    printLockVerificationDiagnostics(diagnostics)
    return diagnostics
  }

  const strictVerification = await verifyOnChainLock(lockAccount)
  diagnostics.strictVerification = strictVerification

  if (!strictVerification.verified) {
    diagnostics.failureDetail = strictVerification.reason
  }

  printLockVerificationDiagnostics(diagnostics)
  return diagnostics
}
