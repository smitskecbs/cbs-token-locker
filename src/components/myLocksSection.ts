import type { LockRecord, MyLocksFilter } from '../types/lock'
import { renderLockTable } from './lockTable'

function renderFilterButton(
  filter: MyLocksFilter,
  label: string,
  activeFilter: MyLocksFilter,
): string {
  const activeClass = filter === activeFilter ? ' is-active' : ''

  return `
    <button
      type="button"
      class="filter-chip${activeClass}"
      data-my-locks-filter="${filter}"
    >
      ${label}
    </button>
  `
}

export function renderMyLocksSection(
  locks: LockRecord[],
  activeFilter: MyLocksFilter = 'all',
  walletConnected = false,
  loading = false,
): string {
  const content = loading
    ? `<p class="empty-state">Loading on-chain locks from Solana…</p>`
    : walletConnected
      ? renderLockTable(
          locks,
          'No on-chain locks match the selected filter for your connected wallet.',
        )
      : `
        <p class="empty-state">
          Connect your wallet to load on-chain locks for your address.
        </p>
      `

  return `
    <section
      class="page-section"
      id="my-locks"
      aria-labelledby="my-locks-heading"
    >
      <h2 class="section-title" id="my-locks-heading">My Locks</h2>
      <div class="panel-card">
        <p class="panel-lead">
          On-chain locks are loaded directly from Solana for your connected wallet.
          No browser storage is used as proof.
        </p>

        <label class="field">
          <span class="field-label">Search My Locks</span>
          <input
            class="field-input"
            type="search"
            id="myLocksSearch"
            placeholder="Search by project name or lock account"
            ${walletConnected ? '' : 'disabled'}
          />
        </label>

        <div class="filter-chip-row" role="group" aria-label="Lock filters">
          ${renderFilterButton('all', 'All', activeFilter)}
          ${renderFilterButton('active', 'Active Locks', activeFilter)}
          ${renderFilterButton('expired', 'Expired Locks', activeFilter)}
          ${renderFilterButton('upcoming', 'Upcoming Unlocks', activeFilter)}
        </div>

        <div id="myLocksResults">
          ${content}
        </div>
      </div>
    </section>
  `
}
