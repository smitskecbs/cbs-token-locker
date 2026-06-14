import type { LockRecord, LockSearchField } from '../types/lock'
import { renderWalletBar } from './walletPanel'
import { renderLockSummaryList } from './lockTable'
import { escapeHtml } from '../utils/html'
import { renderUserFacingErrorHtml } from '../utils/lockUiErrors'
import { getSearchTooShortMessage } from '../utils/searchQuery'

const SEARCH_FIELDS: Array<{ value: LockSearchField; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'lockId', label: 'Lock' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'mint', label: 'Mint' },
  { value: 'project', label: 'Project' },
]

export function renderSearchResults(
  locks: LockRecord[],
  loading = false,
  options?: {
    errorMessage?: string | null
    errorDetails?: string | null
    hintMessage?: string | null
  },
): string {
  if (loading) {
    return `<p class="empty-state">Searching…</p>`
  }

  if (options?.errorMessage) {
    return renderUserFacingErrorHtml(options.errorMessage, options.errorDetails ?? null)
  }

  if (options?.hintMessage) {
    return `
      <div class="empty-state-panel">
        <p class="empty-state__body">${escapeHtml(options.hintMessage)}</p>
      </div>
    `
  }

  return renderLockSummaryList(locks)
}

export function renderSearchTabContent(
  locks: LockRecord[],
  query = '',
  field: LockSearchField = 'all',
  loading = false,
  includeUnlocked = false,
  options?: {
    errorMessage?: string | null
    errorDetails?: string | null
    hintMessage?: string | null
  },
): string {
  const fieldOptions = SEARCH_FIELDS.map((option) => {
    const selected = option.value === field ? ' selected' : ''
    return `<option value="${option.value}"${selected}>${option.label}</option>`
  }).join('')

  const includeChecked = includeUnlocked ? ' checked' : ''

  return `
    <div class="search-tab">
      <div class="field-row">
        <label class="field field--grow">
          <span class="field-label">Search locks</span>
          <input
            class="field-input"
            type="search"
            id="publicLockSearchInput"
            value="${escapeHtml(query)}"
            placeholder="Lock, wallet, mint, or project"
          />
        </label>
        <label class="field">
          <span class="field-label">By</span>
          <select class="field-input field-select" id="publicLockSearchField">
            ${fieldOptions}
          </select>
        </label>
      </div>
      <label class="checkbox-field search-include-unlocked">
        <input
          type="checkbox"
          id="searchIncludeUnlocked"
          data-search-include-unlocked
          ${includeChecked}
        />
        <span>Include unlocked history</span>
      </label>
      <p class="search-hint">${escapeHtml(getSearchTooShortMessage())}</p>
      <div id="publicLockSearchResults">
        ${renderSearchResults(locks, loading, options)}
      </div>
    </div>
  `
}

export function renderPublicLockSearch(
  locks: LockRecord[],
  query = '',
  field: LockSearchField = 'all',
  loading = false,
  includeUnlocked = false,
): string {
  return `
    <section class="main-card page-section" id="public-locks">
      ${renderWalletBar()}
      <h2 class="section-title">Search</h2>
      ${renderSearchTabContent(locks, query, field, loading, includeUnlocked)}
    </section>
  `
}
