/** Anchor `LockerError` codes for CBS Token Locker (starts at 6000). */
export const LOCKER_ANCHOR_ERROR_CODES: Record<number, { name: string; message: string }> = {
  6000: {
    name: 'InvalidAmount',
    message: 'Amount must be greater than zero.',
  },
  6001: {
    name: 'UnlockTimestampNotFuture',
    message: 'Unlock timestamp must be in the future.',
  },
  6002: {
    name: 'ProjectNameTooLong',
    message: 'Project name exceeds the on-chain limit.',
  },
  6003: {
    name: 'MintMismatch',
    message: 'Token mint does not match the source account.',
  },
  6004: {
    name: 'OwnerMismatch',
    message: 'Only the original owner can interact with this lock.',
  },
  6005: {
    name: 'InsufficientBalance',
    message: 'Insufficient token balance in the source account.',
  },
  6006: {
    name: 'InvalidTokenType',
    message: 'Invalid token type. Use 0 for SPL or 1 for LP.',
  },
  6007: {
    name: 'LockPeriodActive',
    message: 'Lock is still active. Early unlock is not allowed.',
  },
  6008: {
    name: 'AlreadyUnlocked',
    message: 'This lock has already been unlocked.',
  },
  6009: {
    name: 'VaultMismatch',
    message: 'Vault account does not match the lock record.',
  },
  6010: {
    name: 'InsufficientVaultBalance',
    message: 'Vault balance is lower than the locked amount.',
  },
}

export function resolveLockerAnchorError(code: number): {
  name: string | null
  message: string | null
} {
  const entry = LOCKER_ANCHOR_ERROR_CODES[code]

  if (!entry) {
    return { name: null, message: null }
  }

  return {
    name: entry.name,
    message: entry.message,
  }
}
