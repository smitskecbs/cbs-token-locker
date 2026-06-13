import type { LockRecord, LockStatus } from '../types/lock'
import { getCachedMintDecimals } from '../solana/mintDecimals'
import { formatAmount, formatTokenAmountFromRaw } from './format'
import { escapeHtml } from './html'
import { formatLockStatus, formatRemainingTime, getDisplayLockStatus } from './time'

export { getDisplayLockStatus, formatLockStatus, formatRemainingTime }

export function getDisplayStatusClass(status: LockStatus): string {
  if (status === 'unlocked') {
    return 'lock-status--unlocked'
  }

  if (status === 'unlock_available') {
    return 'lock-status--unlock-available'
  }

  return 'lock-status--active'
}

export function renderLockStatusMarkup(status: LockStatus): string {
  const className = getDisplayStatusClass(status)
  const label = formatLockStatus(status)

  if (status === 'unlocked') {
    return `<span class="lock-status ${className}"><span class="lock-status__check" aria-hidden="true">✓</span>${escapeHtml(label)}</span>`
  }

  return `<span class="lock-status ${className}">${escapeHtml(label)}</span>`
}

export function formatLockAmountDisplay(
  lock: LockRecord,
  decimals: number | null = getCachedMintDecimals(lock.mint),
): { human: string; raw: string } {
  const raw = formatAmount(lock.amount)
  const human =
    decimals !== null ? formatTokenAmountFromRaw(lock.amount, decimals) : raw

  return { human, raw }
}

export function canUnlockLock(
  lock: LockRecord,
  connectedWallet: string | null,
  now = Date.now(),
): boolean {
  if (!connectedWallet || lock.isUnlocked) {
    return false
  }

  return (
    getDisplayLockStatus(lock, now) === 'unlock_available' &&
    connectedWallet === lock.owner
  )
}

export function isUnlockTimeReached(lock: LockRecord, now = Date.now()): boolean {
  return getDisplayLockStatus(lock, now) === 'unlock_available'
}
