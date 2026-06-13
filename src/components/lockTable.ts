import { getLockStatusForRecord, getPublicLockPath } from '../locker'
import { fetchMintDecimals, getCachedMintDecimals } from '../solana/mintDecimals'
import type { LockRecord } from '../types/lock'
import {
  canUnlockLock,
  formatLockAmountDisplay,
  formatRemainingTime,
  renderLockStatusMarkup,
} from '../utils/lockDisplay'
import { formatDateTime, formatTokenType, formatWalletAddress } from '../utils/format'
import { escapeHtml } from '../utils/html'

export async function enrichLocksWithMintDecimals(locks: LockRecord[]): Promise<void> {
  const uniqueMints = [...new Set(locks.map((lock) => lock.mint))]

  for (const mint of uniqueMints) {
    if (getCachedMintDecimals(mint) !== null) {
      continue
    }

    await fetchMintDecimals(mint)
  }
}

function renderLockTableActions(
  lock: LockRecord,
  connectedWallet: string | null,
  now: number,
): string {
  const viewButton = `
    <a
      class="secondary-btn lock-table-btn"
      href="${getPublicLockPath(lock.lockAccount)}"
      data-router-link
    >
      View
    </a>
  `

  if (!canUnlockLock(lock, connectedWallet, now)) {
    return `<div class="lock-table-actions">${viewButton}</div>`
  }

  return `
    <div class="lock-table-actions">
      ${viewButton}
      <button
        type="button"
        class="unlock-btn lock-table-btn"
        data-unlock-lock="${escapeHtml(lock.lockAccount)}"
      >
        Unlock
      </button>
    </div>
  `
}

export function renderLockTable(
  locks: LockRecord[],
  emptyMessage: string,
  now = Date.now(),
  connectedWallet: string | null = null,
): string {
  if (locks.length === 0) {
    return `<p class="empty-state">${escapeHtml(emptyMessage)}</p>`
  }

  const rows = locks
    .map((lock) => {
      const status = getLockStatusForRecord(lock, now)
      const amount = formatLockAmountDisplay(lock)

      return `
        <tr data-lock-account="${escapeHtml(lock.lockAccount)}">
          <td>
            <a
              class="lock-link"
              href="${getPublicLockPath(lock.lockAccount)}"
              data-router-link
            >
              ${escapeHtml(lock.projectName)}
            </a>
          </td>
          <td>${escapeHtml(formatTokenType(lock.tokenType))}</td>
          <td data-lock-amount>${escapeHtml(amount.human)}</td>
          <td>${escapeHtml(formatDateTime(lock.unlockAt))}</td>
          <td data-lock-status>
            ${renderLockStatusMarkup(status)}
          </td>
          <td data-lock-remaining>
            ${escapeHtml(formatRemainingTime(lock.unlockAt, now, lock.isUnlocked))}
          </td>
          <td data-lock-actions>
            ${renderLockTableActions(lock, connectedWallet, now)}
          </td>
        </tr>
      `
    })
    .join('')

  return `
    <div class="lock-table-wrap">
      <table class="lock-table">
        <thead>
          <tr>
            <th>Project</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Unlock Date</th>
            <th>Status</th>
            <th>Remaining</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `
}

export function updateLockTableRow(
  lock: LockRecord,
  connectedWallet: string | null,
  now = Date.now(),
): void {
  const row = document.querySelector<HTMLTableRowElement>(
    `tr[data-lock-account="${lock.lockAccount}"]`,
  )

  if (!row) {
    return
  }

  const status = getLockStatusForRecord(lock, now)
  const statusCell = row.querySelector<HTMLElement>('[data-lock-status]')
  const remainingCell = row.querySelector<HTMLElement>('[data-lock-remaining]')
  const actionsCell = row.querySelector<HTMLElement>('[data-lock-actions]')

  if (statusCell) {
    statusCell.innerHTML = renderLockStatusMarkup(status)
  }

  if (remainingCell) {
    remainingCell.textContent = formatRemainingTime(lock.unlockAt, now, lock.isUnlocked)
  }

  if (actionsCell) {
    actionsCell.innerHTML = renderLockTableActions(lock, connectedWallet, now)
  }
}

export function renderLockSummaryList(locks: LockRecord[], now = Date.now()): string {
  if (locks.length === 0) {
    return `<p class="empty-state">No matching on-chain locks found.</p>`
  }

  return `
    <ul class="lock-summary-list">
      ${locks
        .map((lock) => {
          const status = getLockStatusForRecord(lock, now)
          const amount = formatLockAmountDisplay(lock)

          return `
            <li class="lock-summary-item">
              <div class="lock-summary-item__header">
                <a
                  class="lock-link"
                  href="${getPublicLockPath(lock.lockAccount)}"
                  data-router-link
                >
                  ${escapeHtml(lock.projectName)}
                </a>
                <span class="lock-id">${escapeHtml(formatWalletAddress(lock.lockAccount, 6))}</span>
              </div>
              <p class="lock-summary-item__meta">
                ${escapeHtml(formatTokenType(lock.tokenType))} ·
                ${escapeHtml(amount.human)} ·
                ${renderLockStatusMarkup(status)} ·
                ${lock.onChainVerified ? 'CBS verified on-chain' : 'Verification pending'}
              </p>
              <p class="lock-summary-item__wallet">
                ${escapeHtml(formatWalletAddress(lock.owner, 6))}
              </p>
            </li>
          `
        })
        .join('')}
    </ul>
  `
}
