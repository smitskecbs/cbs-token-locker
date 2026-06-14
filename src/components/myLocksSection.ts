import type { LockRecord } from '../types/lock'
import { renderUserFacingErrorHtml } from '../utils/lockUiErrors'
import { renderLockTable } from './lockTable'

export function renderMyLocksContent(
  locks: LockRecord[],
  walletConnected = false,
  loading = false,
  connectedWallet: string | null = null,
  errorMessage: string | null = null,
  errorDetails: string | null = null,
): string {
  if (loading) {
    return `<p class="empty-state my-locks-state">Loading your locks...</p>`
  }

  if (!walletConnected) {
    return `
      <div class="empty-state-panel my-locks-state">
        <p class="empty-state__body">Connect your wallet to view your locks.</p>
      </div>
    `
  }

  if (errorMessage) {
    return renderUserFacingErrorHtml(errorMessage, errorDetails)
  }

  return renderLockTable(
    locks,
    'No active locks found.',
    Date.now(),
    connectedWallet,
    { emptyTitle: '', singleLineEmpty: true },
  )
}

/** Standalone section wrapper for /locks route compatibility */
export function renderMyLocksSection(
  locks: LockRecord[],
  _activeFilter = 'all',
  walletConnected = false,
  loading = false,
  connectedWallet: string | null = null,
): string {
  return `
    <section class="page-section" id="my-locks">
      <div id="myLocksResults" class="my-locks-results" aria-live="polite">
        ${renderMyLocksContent(locks, walletConnected, loading, connectedWallet)}
      </div>
    </section>
  `
}
