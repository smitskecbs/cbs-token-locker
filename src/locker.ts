import { address } from '@solana/kit'

import {
  createOnChainLock,
  fetchLocksByOwner,
  fetchOnChainLock,
  searchOnChainLocks,
  unlockOnChainLock,
} from './solana/client'
import type {
  CreateLockInput,
  LockRecord,
  LockSearchField,
  LockStatus,
  MyLocksFilter,
  PreviewLock,
  TokenType,
} from './types/lock'
import type { SolanaWalletProvider } from './wallet'
import {
  combineUnlockDateTime,
  getDisplayLockStatus,
  isUpcomingUnlock,
} from './utils/time'

export class LockerValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LockerValidationError'
  }
}

export function isValidSolanaAddress(value: string): boolean {
  const trimmed = value.trim()

  if (!trimmed || trimmed.startsWith('0x')) {
    return false
  }

  if (trimmed.length < 32 || trimmed.length > 44) {
    return false
  }

  try {
    address(trimmed)
    return true
  } catch {
    return false
  }
}

export function validateCreateLockInput(input: CreateLockInput): void {
  if (!input.projectName.trim()) {
    throw new LockerValidationError('Project name is required.')
  }

  if (!isValidSolanaAddress(input.tokenMint)) {
    throw new LockerValidationError('Enter a valid token mint address.')
  }

  const amount = Number(input.amount.replaceAll(',', '').trim())

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new LockerValidationError('Amount must be greater than zero.')
  }

  if (!input.unlockDate.trim()) {
    throw new LockerValidationError('Unlock date is required.')
  }

  if (!input.unlockTime.trim()) {
    throw new LockerValidationError('Unlock time is required.')
  }

  const unlockAt = combineUnlockDateTime(input.unlockDate, input.unlockTime)

  if (Number.isNaN(new Date(unlockAt).getTime())) {
    throw new LockerValidationError('Unlock date and time are invalid.')
  }

  if (new Date(unlockAt).getTime() <= Date.now()) {
    throw new LockerValidationError('Unlock date must be in the future.')
  }

  if (!isValidSolanaAddress(input.lockerWallet)) {
    throw new LockerValidationError('Connect a wallet before creating an on-chain lock.')
  }
}

export function buildLockPreview(input: CreateLockInput): PreviewLock {
  validateCreateLockInput(input)

  return {
    mode: 'preview',
    projectName: input.projectName.trim(),
    projectDescription: input.projectDescription.trim(),
    tokenMint: input.tokenMint.trim(),
    tokenType: input.tokenType,
    amount: input.amount.trim(),
    lockerWallet: input.lockerWallet.trim(),
    unlockAt: combineUnlockDateTime(input.unlockDate, input.unlockTime),
  }
}

export async function getLockByAccount(lockAccount: string): Promise<LockRecord | null> {
  return fetchOnChainLock(lockAccount)
}

export async function getLocksForWallet(walletAddress: string): Promise<LockRecord[]> {
  return fetchLocksByOwner(walletAddress)
}

export async function searchLocks(
  query: string,
  field: LockSearchField = 'all',
): Promise<LockRecord[]> {
  return searchOnChainLocks(query, field)
}

export function filterActiveWalletLocks(
  locks: LockRecord[],
  now = Date.now(),
): LockRecord[] {
  return locks.filter((lock) => {
    const status = getLockStatusForRecord(lock, now)
    return status === 'active' || status === 'unlock_available'
  })
}

/** Default search results: active and unlock-available only. */
export function filterSearchLocks(
  locks: LockRecord[],
  includeUnlocked = false,
  now = Date.now(),
): LockRecord[] {
  if (includeUnlocked) {
    return locks
  }

  return filterActiveWalletLocks(locks, now)
}

export function sortLocksNewestFirst(locks: LockRecord[]): LockRecord[] {
  return [...locks].sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  })
}

export function filterHistoryWalletLocks(
  locks: LockRecord[],
  now = Date.now(),
): LockRecord[] {
  return locks.filter((lock) => getLockStatusForRecord(lock, now) === 'unlocked')
}

export function filterMyLocks(
  locks: LockRecord[],
  filter: MyLocksFilter,
  now = Date.now(),
): LockRecord[] {
  if (filter === 'all') {
    return locks
  }

  return locks.filter((lock) => {
    const status = getLockStatusForRecord(lock, now)

    if (filter === 'active') {
      return status === 'active'
    }

    if (filter === 'expired') {
      return status === 'unlocked' || status === 'unlock_available'
    }

    return isUpcomingUnlock(lock.unlockAt, now)
  })
}

export function getLockStatusForRecord(lock: LockRecord, now = Date.now()): LockStatus {
  return getDisplayLockStatus(lock, now)
}

export async function unlockOnChainLockRecord(
  lockAccount: string,
  walletProvider: SolanaWalletProvider,
  walletAddress: string,
): Promise<LockRecord> {
  return unlockOnChainLock(lockAccount, walletProvider, walletAddress)
}

export async function createOnChainLockRecord(
  input: CreateLockInput,
  walletProvider: SolanaWalletProvider,
): Promise<LockRecord> {
  validateCreateLockInput(input)
  return createOnChainLock(input, walletProvider)
}

export function getTokenTypeLabel(tokenType: TokenType): string {
  if (tokenType === 'lp') {
    return 'LP Token'
  }

  if (tokenType === 'spl') {
    return 'SPL Token'
  }

  if (tokenType === 'clmm') {
    return 'CLMM Position NFT'
  }

  return 'Token'
}

export function getPublicLockPath(lockAccount: string): string {
  return `/lock/${encodeURIComponent(lockAccount)}`
}
