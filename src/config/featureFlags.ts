/** CLMM create/submit is off unless VITE_ENABLE_CLMM_LOCKING=true at build time. */
export function isClmmLockingEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_CLMM_LOCKING === 'true'
}
