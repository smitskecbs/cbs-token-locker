export const RPC_RATE_LIMIT_MESSAGE =
  'Solana RPC is rate-limiting requests. Please wait a moment and try again.'

export const PROGRAM_STATUS_RATE_LIMIT_MESSAGE =
  'Unable to verify program status because the RPC is rate-limiting requests.'

export const LIVE_REFRESH_INTERVAL_MS = 30_000

let lockCreationInProgress = false

export function setLockCreationInProgress(active: boolean): void {
  lockCreationInProgress = active
}

export function isLockCreationInProgress(): boolean {
  return lockCreationInProgress
}

export function shouldPauseBackgroundRpcRefresh(): boolean {
  return lockCreationInProgress
}
