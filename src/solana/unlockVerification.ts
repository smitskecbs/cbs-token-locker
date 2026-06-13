import { address } from '@solana/kit'
import { fetchMaybeToken, findAssociatedTokenPda } from '@solana-program/token'

import type { LockRecord } from '../types/lock'
import { safeJsonStringify } from '../utils/safeSerialize'
import { getSolanaRpc } from './rpc'

export type TokenBalanceSnapshot = {
  address: string
  exists: boolean
  amount: string
  mint: string | null
  owner: string | null
}

export type UnlockInstructionAccounts = {
  sourceVault: string
  destinationOwnerAta: string
  authorityLockPda: string
  ownerWallet: string
  tokenProgram: string
}

export type UnlockTransferDiagnostics = {
  lockAccount: string
  vaultTokenAccount: string
  ownerTokenAccount: string
  transferredAmount: string
  signature: string
  instructionAccounts: UnlockInstructionAccounts
  before: {
    vault: TokenBalanceSnapshot
    ownerAta: TokenBalanceSnapshot
  }
  after: {
    vault: TokenBalanceSnapshot
    ownerAta: TokenBalanceSnapshot
  }
  vaultBalanceDecreased: boolean
  ownerBalanceIncreased: boolean
  lockFlagUnlocked: boolean
  transferVerified: boolean
  failureReason: string | null
}

export type UnlockedLockInspection = {
  lockAccount: string
  isUnlockedFlag: boolean
  lockedAmount: string
  vault: TokenBalanceSnapshot
  ownerAta: TokenBalanceSnapshot
  tokensReturnedToOwner: boolean
  vaultEmptied: boolean
  summary: string
}

export async function fetchTokenBalanceSnapshot(
  tokenAccountAddress: string,
): Promise<TokenBalanceSnapshot> {
  const rpc = getSolanaRpc()
  const tokenAccount = await fetchMaybeToken(rpc, address(tokenAccountAddress))

  if (!tokenAccount.exists) {
    return {
      address: tokenAccountAddress,
      exists: false,
      amount: '0',
      mint: null,
      owner: null,
    }
  }

  return {
    address: tokenAccountAddress,
    exists: true,
    amount: tokenAccount.data.amount.toString(),
    mint: tokenAccount.data.mint,
    owner: tokenAccount.data.owner,
  }
}

export function logUnlockDiagnostics(diagnostics: UnlockTransferDiagnostics): void {
  console.info('[CBS Locker] unlock diagnostics', safeJsonStringify(diagnostics))
}

export function logUnlockedLockInspection(inspection: UnlockedLockInspection): void {
  console.info('[CBS Locker] unlocked lock inspection', safeJsonStringify(inspection))
}

export function buildUnlockInstructionAccounts(input: {
  lockAccount: string
  vault: string
  ownerTokenAccount: string
  ownerWallet: string
  tokenProgram: string
}): UnlockInstructionAccounts {
  return {
    sourceVault: input.vault,
    destinationOwnerAta: input.ownerTokenAccount,
    authorityLockPda: input.lockAccount,
    ownerWallet: input.ownerWallet,
    tokenProgram: input.tokenProgram,
  }
}

export async function verifyUnlockTransfer(input: {
  lock: LockRecord
  signature: string
  vaultTokenAccount: string
  ownerTokenAccount: string
  instructionAccounts: UnlockInstructionAccounts
  beforeVault: TokenBalanceSnapshot
  beforeOwnerAta: TokenBalanceSnapshot
  afterVault: TokenBalanceSnapshot
  afterOwnerAta: TokenBalanceSnapshot
  lockFlagUnlocked: boolean
}): Promise<UnlockTransferDiagnostics> {
  const expectedAmount = BigInt(input.lock.amount)
  const vaultBefore = BigInt(input.beforeVault.amount)
  const vaultAfter = BigInt(input.afterVault.amount)
  const ownerBefore = BigInt(input.beforeOwnerAta.amount)
  const ownerAfter = BigInt(input.afterOwnerAta.amount)
  const vaultDecrease = vaultBefore - vaultAfter
  const ownerIncrease = ownerAfter - ownerBefore

  const vaultBalanceDecreased = vaultAfter < vaultBefore
  const ownerBalanceIncreased = ownerAfter > ownerBefore
  const vaultDecreasedByLockedAmount = vaultDecrease === expectedAmount
  const ownerIncreasedByLockedAmount = ownerIncrease === expectedAmount
  const vaultEmptiedAfterUnlock = vaultAfter === 0n

  let failureReason: string | null = null

  if (!input.lockFlagUnlocked) {
    failureReason = 'Lock account is_unlocked flag is still false after confirmation.'
  } else if (!vaultBalanceDecreased) {
    failureReason = 'Vault balance did not decrease after unlock.'
  } else if (!ownerBalanceIncreased) {
    failureReason =
      'Owner associated token account balance did not increase. Tokens may not have reached the owner ATA.'
  } else if (!vaultDecreasedByLockedAmount) {
    failureReason = `Vault decreased by ${vaultDecrease.toString()} instead of locked amount ${expectedAmount.toString()}.`
  } else if (!ownerIncreasedByLockedAmount) {
    failureReason = `Owner ATA increased by ${ownerIncrease.toString()} instead of locked amount ${expectedAmount.toString()}.`
  } else if (!vaultEmptiedAfterUnlock) {
    failureReason = `Vault still holds ${vaultAfter.toString()} tokens after unlock.`
  }

  const transferVerified = failureReason === null

  return {
    lockAccount: input.lock.lockAccount,
    vaultTokenAccount: input.vaultTokenAccount,
    ownerTokenAccount: input.ownerTokenAccount,
    transferredAmount: input.lock.amount,
    signature: input.signature,
    instructionAccounts: input.instructionAccounts,
    before: {
      vault: input.beforeVault,
      ownerAta: input.beforeOwnerAta,
    },
    after: {
      vault: input.afterVault,
      ownerAta: input.afterOwnerAta,
    },
    vaultBalanceDecreased,
    ownerBalanceIncreased,
    lockFlagUnlocked: input.lockFlagUnlocked,
    transferVerified,
    failureReason,
  }
}

export async function inspectUnlockedLock(lock: LockRecord): Promise<UnlockedLockInspection> {
  const vault = await fetchTokenBalanceSnapshot(lock.vault)
  const ownerAta = await fetchTokenBalanceSnapshot(
    await resolveOwnerAtaForLock(lock),
  )
  const lockedAmount = BigInt(lock.amount)
  const vaultBalance = BigInt(vault.amount)
  const ownerBalance = BigInt(ownerAta.amount)
  const vaultEmptied = vaultBalance === 0n
  const tokensReturnedToOwner = lock.isUnlocked && vaultEmptied && ownerBalance > 0n

  let summary: string

  if (!lock.isUnlocked) {
    summary = 'Lock is not marked unlocked on-chain.'
  } else if (vaultBalance >= lockedAmount) {
    summary =
      'Lock is marked UNLOCKED but the vault still holds the locked amount. Tokens were likely not transferred to the owner.'
  } else if (vaultEmptied && ownerBalance === 0n) {
    summary =
      'Vault was emptied but owner ATA balance is zero. Tokens may have been moved out of the owner ATA after unlock.'
  } else if (tokensReturnedToOwner) {
    summary = 'Vault emptied and owner ATA holds tokens. Unlock transfer appears successful.'
  } else {
    summary = 'Unlock state is ambiguous. Review vault and owner ATA balances manually.'
  }

  const inspection: UnlockedLockInspection = {
    lockAccount: lock.lockAccount,
    isUnlockedFlag: lock.isUnlocked,
    lockedAmount: lock.amount,
    vault,
    ownerAta,
    tokensReturnedToOwner,
    vaultEmptied,
    summary,
  }

  logUnlockedLockInspection(inspection)
  return inspection
}

async function resolveOwnerAtaForLock(lock: LockRecord): Promise<string> {
  const [ownerAta] = await findAssociatedTokenPda({
    owner: address(lock.owner),
    mint: address(lock.mint),
    tokenProgram: address(lock.tokenProgram),
  })

  return ownerAta
}

export async function captureUnlockBalanceSnapshots(input: {
  vault: string
  ownerTokenAccount: string
}): Promise<{
  vault: TokenBalanceSnapshot
  ownerAta: TokenBalanceSnapshot
}> {
  const [vault, ownerAta] = await Promise.all([
    fetchTokenBalanceSnapshot(input.vault),
    fetchTokenBalanceSnapshot(input.ownerTokenAccount),
  ])

  console.info('[CBS Locker] unlock balance snapshot', safeJsonStringify({ vault, ownerAta }))

  return { vault, ownerAta }
}
