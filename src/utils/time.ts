import type { LockRecord, LockStatus } from '../types/lock'

export function getDisplayLockStatus(lock: LockRecord, now = Date.now()): LockStatus {
  if (lock.isUnlocked) {
    return 'unlocked'
  }

  const unlockTime = new Date(lock.unlockAt).getTime()

  if (!Number.isNaN(unlockTime) && now >= unlockTime) {
    return 'unlock_available'
  }

  return 'active'
}

/** @deprecated Use getDisplayLockStatus */
export function getLockDisplayStatus(lock: LockRecord, now = Date.now()): LockStatus {
  return getDisplayLockStatus(lock, now)
}

export function getLockStatus(unlockAt: string, now = Date.now()): LockStatus {
  const unlockTime = new Date(unlockAt).getTime()

  if (Number.isNaN(unlockTime)) {
    return 'active'
  }

  return now >= unlockTime ? 'unlock_available' : 'active'
}

export function formatLockStatus(status: LockStatus): string {
  if (status === 'unlocked') {
    return 'Unlocked'
  }

  if (status === 'unlock_available') {
    return 'Unlock Available'
  }

  return 'Active'
}

export function formatRemainingTime(
  unlockAt: string,
  now = Date.now(),
  isUnlocked = false,
): string {
  if (isUnlocked) {
    return 'Completed'
  }

  const unlockTime = new Date(unlockAt).getTime()

  if (Number.isNaN(unlockTime)) {
    return 'Unknown'
  }

  const diffMs = unlockTime - now

  if (diffMs <= 0) {
    return 'Unlock available now'
  }

  const totalMinutes = Math.floor(diffMs / 60_000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) {
    return `${days} day${days === 1 ? '' : 's'}, ${hours} hour${hours === 1 ? '' : 's'}`
  }

  if (hours > 0) {
    return `${hours} hour${hours === 1 ? '' : 's'}, ${minutes} minute${minutes === 1 ? '' : 's'}`
  }

  return `${minutes} minute${minutes === 1 ? '' : 's'}`
}

export function combineUnlockDateTime(
  unlockDate: string,
  unlockTime: string,
): string {
  const dateValue = unlockDate.trim()
  const timeValue = unlockTime.trim() || '00:00'

  return new Date(`${dateValue}T${timeValue}`).toISOString()
}

export function isUpcomingUnlock(unlockAt: string, now = Date.now()): boolean {
  const unlockTime = new Date(unlockAt).getTime()

  if (Number.isNaN(unlockTime) || unlockTime <= now) {
    return false
  }

  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000

  return unlockTime - now <= sevenDaysMs
}
