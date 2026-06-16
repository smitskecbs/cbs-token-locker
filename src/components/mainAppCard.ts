import type { LockRecord, LockSearchField } from '../types/lock'
import { renderCreateLockForm } from './createLockForm'
import { renderHistoryPanel } from './historySection'
import { renderMyLocksContent } from './myLocksSection'
import { renderSearchTabContent } from './publicLockSearch'
import { renderWalletBar } from './walletPanel'

export type AppTabId = 'create' | 'locks' | 'history' | 'search'

export function renderMainAppCard(input: {
  activeTab?: AppTabId
  locks?: LockRecord[]
  walletConnected?: boolean
  locksLoading?: boolean
  connectedWallet?: string | null
  searchQuery?: string
  searchField?: LockSearchField
  searchLoading?: boolean
  searchResults?: LockRecord[]
}): string {
  const activeTab = input.activeTab ?? 'create'
  const locks = input.locks ?? []
  const walletConnected = input.walletConnected ?? false
  const locksLoading = input.locksLoading ?? false
  const connectedWallet = input.connectedWallet ?? null
  const searchQuery = input.searchQuery ?? ''
  const searchField = input.searchField ?? 'all'
  const searchLoading = input.searchLoading ?? false
  const searchResults = input.searchResults ?? []

  const tabButton = (id: AppTabId, label: string) => {
    const activeClass = activeTab === id ? ' is-active' : ''
    return `
      <button
        type="button"
        class="app-tab${activeClass}"
        data-app-tab="${id}"
        aria-selected="${activeTab === id ? 'true' : 'false'}"
      >
        ${label}
      </button>
    `
  }

  const panelAttrs = (id: AppTabId, extraId?: string) => {
    const hidden = activeTab === id ? '' : ' hidden'
    const panelId = extraId ? ` id="${extraId}"` : ''
    return `${panelId} class="app-tab-panel${activeTab === id ? ' is-active' : ''}" data-app-tab-panel="${id}"${hidden}`
  }

  return `
    <section class="main-card locker-card" id="main-app" aria-label="CBS Token Locker">
      ${renderWalletBar()}

      <nav class="app-tabs" role="tablist" aria-label="Locker sections">
        ${tabButton('create', 'Create Lock')}
        ${tabButton('locks', 'My Locks')}
        ${tabButton('history', 'History')}
        ${tabButton('search', 'Search')}
      </nav>

      <div class="app-tab-panels">
        <div ${panelAttrs('create', 'create-lock')}>
          ${renderCreateLockForm()}
        </div>

        <div ${panelAttrs('locks', 'my-locks')}>
          <div class="locks-toolbar">
            <button type="button" class="secondary-btn" data-refresh-my-locks>
              Refresh Locks
            </button>
          </div>
          <div id="myLocksResults" class="my-locks-results" aria-live="polite">
            ${renderMyLocksContent(locks, walletConnected, locksLoading, connectedWallet)}
          </div>
        </div>

        <div ${panelAttrs('history', 'lock-history')}>
          <div id="historyResults" class="my-locks-results" aria-live="polite">
            ${renderHistoryPanel({ kind: 'idle' }, connectedWallet)}
          </div>
        </div>

        <div ${panelAttrs('search', 'public-locks')}>
          ${renderSearchTabContent(searchResults, searchQuery, searchField, searchLoading)}
        </div>
      </div>
    </section>
  `
}
