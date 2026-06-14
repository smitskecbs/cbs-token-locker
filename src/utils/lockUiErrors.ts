import { LockApiError } from '../services/lockApiError'
import { formatLockerError } from '../solana/errors'
import { isRpcRateLimitError } from '../solana/rpcFetch'
import { escapeHtml } from './html'

export const RPC_BUSY_USER_MESSAGE =
  'Solana RPC is busy. Please wait a moment and try again.'

export function isRpcBusyError(error: unknown): boolean {
  if (error instanceof LockApiError) {
    return error.code === 'RPC_RATE_LIMIT'
  }

  return isRpcRateLimitError(error)
}

export function formatUserFacingLockError(
  error: unknown,
  cluster = 'this cluster',
): { message: string; details: string | null } {
  const technical = formatLockerError(error, cluster)

  if (isRpcBusyError(error)) {
    return {
      message: RPC_BUSY_USER_MESSAGE,
      details: technical,
    }
  }

  if (error instanceof LockApiError && error.code === 'RPC_ERROR') {
    return {
      message: RPC_BUSY_USER_MESSAGE,
      details: technical,
    }
  }

  return {
    message: technical,
    details: error instanceof LockApiError && error.details ? error.details : null,
  }
}

export function renderUserFacingErrorHtml(message: string, details: string | null = null): string {
  if (!details) {
    return `
      <div class="empty-state-panel">
        <p class="empty-state__body">${escapeHtml(message)}</p>
      </div>
    `
  }

  return `
    <div class="empty-state-panel">
      <p class="empty-state__body">${escapeHtml(message)}</p>
      <details class="technical-details technical-details--error">
        <summary class="technical-details__summary technical-details__summary--compact">Show details</summary>
        <pre class="mono simulation-debug__pre">${escapeHtml(details)}</pre>
      </details>
    </div>
  `
}
