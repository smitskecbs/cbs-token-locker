import { getLockStatusForRecord, getPublicLockPath } from '../locker'
import { fetchMintDecimals, getCachedMintDecimals } from '../solana/mintDecimals'
import type { LockRecord } from '../types/lock'
import {
  canUnlockLock,
  formatLockAmountDisplay,
  renderLockStatusMarkup,
} from '../utils/lockDisplay'
import { formatDateTime } from '../utils/format'
import { renderTokenTypeBadgeMarkup } from '../utils/tokenTypeDisplay'
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

function renderLockActions(
  lock: LockRecord,
  connectedWallet: string | null,
  now: number,
): string {
  const viewButton = `
    <a
      class="secondary-btn lock-card-btn"
      href="${getPublicLockPath(lock.lockAccount)}"
      data-router-link
    >
      View
    </a>
  `

  if (!canUnlockLock(lock, connectedWallet, now)) {
    return viewButton
  }

  return `
    ${viewButton}
    <button
      type="button"
      class="unlock-btn lock-card-btn"
      data-unlock-lock="${escapeHtml(lock.lockAccount)}"
    >
      Unlock
    </button>
  `
}

function renderLockCard(
  lock: LockRecord,
  connectedWallet: string | null,
  now: number,
): string {
  const status = getLockStatusForRecord(lock, now)
  const amount = formatLockAmountDisplay(lock)

  return `
    <article class="lock-card" data-lock-account="${escapeHtml(lock.lockAccount)}">
      <div class="lock-card__top">
        <div class="lock-card__heading">
          <h3 class="lock-card__title">${escapeHtml(lock.projectName)}</h3>
          ${renderTokenTypeBadgeMarkup(lock.tokenType)}
        </div>
        <span data-lock-status>${renderLockStatusMarkup(status)}</span>
      </div>
      <p class="lock-card__line">
        <span data-lock-amount>${escapeHtml(amount.human)}</span>
        · ${escapeHtml(formatDateTime(lock.unlockAt))}
      </p>
      <div class="lock-card__actions" data-lock-actions>
        ${renderLockActions(lock, connectedWallet, now)}
      </div>
    </article>
  `
}

export function renderLockTable(
  locks: LockRecord[],
  emptyMessage: string,
  now = Date.now(),
  connectedWallet: string | null = null,
  options?: { emptyTitle?: string; singleLineEmpty?: boolean },
): string {
  if (locks.length === 0) {
    if (options?.singleLineEmpty) {
      return `
        <div class="empty-state-panel">
          <p class="empty-state__body">${escapeHtml(emptyMessage)}</p>
        </div>
      `
    }

    const emptyTitle = options?.emptyTitle ?? 'No locks yet.'

    return `
      <div class="empty-state-panel">
        <p class="empty-state__title">${emptyTitle}</p>
        <p class="empty-state__body">${escapeHtml(emptyMessage)}</p>
      </div>
    `
  }

  return `
    <div class="lock-card-list">
      ${locks.map((lock) => renderLockCard(lock, connectedWallet, now)).join('')}
    </div>
  `
}

export function updateLockTableRow(
  lock: LockRecord,
  connectedWallet: string | null,
  now = Date.now(),
): void {
  const card = document.querySelector<HTMLElement>(
    `.lock-card[data-lock-account="${lock.lockAccount}"]`,
  )

  if (!card) {
    return
  }

  const status = getLockStatusForRecord(lock, now)
  const amount = formatLockAmountDisplay(lock)

  const statusElement = card.querySelector<HTMLElement>('[data-lock-status]')
  const amountElement = card.querySelector<HTMLElement>('[data-lock-amount]')
  const actionsElement = card.querySelector<HTMLElement>('[data-lock-actions]')

  if (statusElement) {
    statusElement.innerHTML = renderLockStatusMarkup(status)
  }

  if (amountElement) {
    amountElement.textContent = amount.human
  }

  if (actionsElement) {
    actionsElement.innerHTML = renderLockActions(lock, connectedWallet, now)
  }
}

export function renderLockSummaryList(
  locks: LockRecord[],
  now = Date.now(),
  options?: { includeUnlocked?: boolean },
): string {
  if (locks.length === 0) {
    if (options?.includeUnlocked) {
      return `
        <div class="empty-state-panel">
          <p class="empty-state__body">No matching locks found.</p>
        </div>
      `
    }

    return `
      <div class="empty-state-panel">
        <p class="empty-state__body">No active locks found.</p>
        <p class="empty-state__hint">Try searching by token mint, wallet address, project name, or lock account.</p>
      </div>
    `
  }

  return `
    <ul class="lock-summary-list">
      ${locks
        .map((lock) => {
          const status = getLockStatusForRecord(lock, now)
          const amount = formatLockAmountDisplay(lock)

          return `
            <li class="lock-summary-item">
              <a
                class="lock-link"
                href="${getPublicLockPath(lock.lockAccount)}"
                data-router-link
              >
                ${escapeHtml(lock.projectName)}
              </a>
              <span class="lock-summary-item__meta">
                ${renderTokenTypeBadgeMarkup(lock.tokenType)}
                ${escapeHtml(amount.human)} · ${renderLockStatusMarkup(status)}
              </span>
            </li>
          `
        })
        .join('')}
    </ul>
  `
}
