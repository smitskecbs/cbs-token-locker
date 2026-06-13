import type { LockRecord, LockSearchField } from '../types/lock'
import { renderLockSummaryList } from './lockTable'

const SEARCH_FIELDS: Array<{ value: LockSearchField; label: string }> = [
  { value: 'all', label: 'All Fields' },
  { value: 'lockId', label: 'Lock Account' },
  { value: 'wallet', label: 'Wallet Address' },
  { value: 'mint', label: 'Token Mint Address' },
  { value: 'project', label: 'Project Name' },
]

export function renderPublicLockSearch(
  locks: LockRecord[],
  query = '',
  field: LockSearchField = 'all',
  loading = false,
): string {
  const fieldOptions = SEARCH_FIELDS.map((option) => {
    const selected = option.value === field ? ' selected' : ''

    return `<option value="${option.value}"${selected}>${option.label}</option>`
  }).join('')

  const results = loading
    ? `<p class="empty-state">Searching on-chain locks…</p>`
    : renderLockSummaryList(locks)

  return `
    <section
      class="page-section"
      id="public-locks"
      aria-labelledby="public-locks-heading"
    >
      <h2 class="section-title" id="public-locks-heading">Public Lock Search</h2>
      <div class="panel-card">
        <p class="panel-lead">
          Search publicly verifiable on-chain locks by lock account, wallet address,
          token mint, or on-chain project name.
        </p>

        <div class="field-row">
          <label class="field field--grow">
            <span class="field-label">Search</span>
            <input
              class="field-input"
              type="search"
              id="publicLockSearchInput"
              value="${query.replaceAll('"', '&quot;')}"
              placeholder="Search on-chain locks"
            />
          </label>

          <label class="field">
            <span class="field-label">Search By</span>
            <select class="field-input field-select" id="publicLockSearchField">
              ${fieldOptions}
            </select>
          </label>
        </div>

        <div id="publicLockSearchResults">
          ${results}
        </div>
      </div>
    </section>
  `
}
