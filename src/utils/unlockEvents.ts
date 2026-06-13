import type { LockRecord } from '../types/lock'

export const LOCK_UNLOCKED_EVENT = 'cbs-lock-unlocked'

export function dispatchLockUnlocked(lock: LockRecord): void {
  window.dispatchEvent(
    new CustomEvent<LockRecord>(LOCK_UNLOCKED_EVENT, {
      detail: lock,
    }),
  )
}

export function subscribeToLockUnlocked(listener: (lock: LockRecord) => void): () => void {
  const handler = (event: Event): void => {
    const customEvent = event as CustomEvent<LockRecord>

    if (customEvent.detail) {
      listener(customEvent.detail)
    }
  }

  window.addEventListener(LOCK_UNLOCKED_EVENT, handler)

  return () => {
    window.removeEventListener(LOCK_UNLOCKED_EVENT, handler)
  }
}
