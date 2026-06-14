import { isValidSolanaAddress } from '../locker'
import type { LockSearchField } from '../types/lock'

const MIN_SEARCH_LENGTH = 3

export function isExactLockAccountQuery(query: string, field: LockSearchField): boolean {
  const trimmed = query.trim()

  if (!trimmed) {
    return false
  }

  if (field === 'lockId') {
    return true
  }

  return isValidSolanaAddress(trimmed)
}

export function shouldRunLockSearch(query: string, field: LockSearchField): boolean {
  const trimmed = query.trim()

  if (!trimmed) {
    return false
  }

  if (isExactLockAccountQuery(trimmed, field)) {
    return true
  }

  return trimmed.length >= MIN_SEARCH_LENGTH
}

export function getSearchTooShortMessage(): string {
  return 'Enter at least 3 characters to search, or paste a full lock account address.'
}
