import type { LockRecord } from '../types/lock'
import { escapeHtml } from '../utils/html'
import { renderLockTable } from './lockTable'

export type HistoryPanelState =
  | { kind: 'disconnected' }
  | { kind: 'idle' }
  | { kind: 'loading' }
  | {
      kind: 'ready'
      locks: LockRecord[]
      visibleCount: number
      totalCount: number
    }
  | { kind: 'error'; message: string; details: string | null }

export function renderHistoryPanel(
  state: HistoryPanelState,
  connectedWallet: string | null = null,
): string {
  if (state.kind === 'disconnected') {
    return `
      <div class="empty-state-panel my-locks-state">
        <p class="empty-state__body">Connect your wallet to view lock history.</p>
      </div>
    `
  }

  if (state.kind === 'idle') {
    return `
      <div class="empty-state-panel my-locks-state history-idle">
        <p class="empty-state__body">
          History can contain many locks. Click Load History to fetch completed locks.
        </p>
        <button type="button" class="primary-btn" id="loadHistoryBtn" data-load-history>
          Load History
        </button>
      </div>
    `
  }

  if (state.kind === 'loading') {
    return `<p class="empty-state my-locks-state">Loading lock history...</p>`
  }

  if (state.kind === 'error') {
    const detailsBlock = state.details
      ? `
        <details class="technical-details technical-details--error">
          <summary class="technical-details__summary technical-details__summary--compact">Show details</summary>
          <pre class="mono simulation-debug__pre">${escapeHtml(state.details)}</pre>
        </details>
      `
      : ''

    return `
      <div class="empty-state-panel my-locks-state">
        <p class="empty-state__body">${escapeHtml(state.message)}</p>
        ${detailsBlock}
        <button type="button" class="secondary-btn" id="loadHistoryBtn" data-load-history>
          Try Again
        </button>
      </div>
    `
  }

  const visibleLocks = state.locks.slice(0, state.visibleCount)
  const hasMore = state.visibleCount < state.totalCount

  const listHtml =
    visibleLocks.length === 0
      ? `
        <div class="empty-state-panel">
          <p class="empty-state__body">No lock history found.</p>
        </div>
      `
      : renderLockTable(visibleLocks, 'No lock history found.', Date.now(), connectedWallet, {
          emptyTitle: '',
          singleLineEmpty: true,
        })

  const loadMoreButton = hasMore
    ? `
      <button type="button" class="secondary-btn history-load-more" id="loadMoreHistoryBtn" data-load-more-history>
        Load More
      </button>
    `
    : ''

  return `
    <div class="history-results">
      <div class="history-toolbar">
        <button type="button" class="secondary-btn" data-refresh-history>
          Refresh History
        </button>
      </div>
      ${listHtml}
      ${loadMoreButton}
    </div>
  `
}

/** @deprecated Use renderHistoryPanel */
export function renderHistoryContent(
  locks: LockRecord[],
  walletConnected = false,
  loading = false,
  connectedWallet: string | null = null,
  errorMessage: string | null = null,
): string {
  if (!walletConnected) {
    return renderHistoryPanel({ kind: 'disconnected' }, connectedWallet)
  }

  if (loading) {
    return renderHistoryPanel({ kind: 'loading' }, connectedWallet)
  }

  if (errorMessage) {
    return renderHistoryPanel({ kind: 'error', message: errorMessage, details: null }, connectedWallet)
  }

  if (locks.length === 0) {
    return renderHistoryPanel({ kind: 'idle' }, connectedWallet)
  }

  return renderHistoryPanel(
    {
      kind: 'ready',
      locks,
      visibleCount: locks.length,
      totalCount: locks.length,
    },
    connectedWallet,
  )
}
