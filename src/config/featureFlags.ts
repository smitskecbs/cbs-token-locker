function readEnv(key: string): string | undefined {
  if (typeof import.meta !== 'undefined' && import.meta.env?.[key]?.trim()) {
    return import.meta.env[key]!.trim()
  }

  return undefined
}

/** CLMM create/submit is off unless VITE_ENABLE_CLMM_LOCKING=true at build time. */
export function isClmmLockingEnabled(): boolean {
  return readEnv('VITE_ENABLE_CLMM_LOCKING') === 'true'
}
