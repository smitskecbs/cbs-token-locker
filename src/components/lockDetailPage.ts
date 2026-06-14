import { getPublicLockPath } from '../locker'
import { fetchLockFromApi } from '../services/lockApi'
import { getSelectedNetwork } from '../solana/cluster'
import { getOrbAccountUrl } from '../solana/config'
import { fetchOnChainLock } from '../solana/client'
import { fetchMintDecimalsForLock } from '../solana/mintDecimals'
import { inspectUnlockedLock } from '../solana/unlockVerification'
import { LIVE_REFRESH_INTERVAL_MS } from '../state/rpcActivityStore'
import type { LockRecord } from '../types/lock'
import { formatDateTime, formatTokenType, formatWalletAddress } from '../utils/format'
import { escapeHtml } from '../utils/html'
import {
  canUnlockLock,
  formatLockAmountDisplay,
  getDisplayLockStatus,
  isUnlockTimeReached,
  renderLockStatusMarkup,
} from '../utils/lockDisplay'
import { executeUnlockLock } from '../utils/unlockLock'
import { showSuccessToast } from '../utils/toast'
import {
  getWalletConnectionState,
  subscribeToWalletConnection,
} from '../wallet'

import { renderSiteFooter, attachSiteFooterHandlers } from './siteFooter'

export type LockDetailContext = {
  lock: LockRecord | null
  mintDecimals: number | null
  connectedWallet: string | null
}

let lockDetailRefreshTimer: ReturnType<typeof setInterval> | null = null
let lockDetailWalletUnsubscribe: (() => void) | null = null
let activeLockDetailAccount: string | null = null
let activeLockDetailRecord: LockRecord | null = null

export function stopLockDetailLiveRefresh(): void {
  if (lockDetailRefreshTimer !== null) {
    clearInterval(lockDetailRefreshTimer)
    lockDetailRefreshTimer = null
  }

  if (lockDetailWalletUnsubscribe) {
    lockDetailWalletUnsubscribe()
    lockDetailWalletUnsubscribe = null
  }

  activeLockDetailAccount = null
  activeLockDetailRecord = null
}

function renderUnlockSection(lock: LockRecord, connectedWallet: string | null, now = Date.now()): string {
  if (lock.isUnlocked) {
    return `
      <div id="lockUnlockSection" class="lock-detail-unlock">
        <div class="success-panel" id="unlockSuccessPanel" role="status">
          <p class="success-panel__title">Tokens unlocked successfully.</p>
          <p class="success-panel__body">Tokens have been returned to your wallet.</p>
        </div>
      </div>
    `
  }

  if (!isUnlockTimeReached(lock, now)) {
    return '<div id="lockUnlockSection"></div>'
  }

  if (connectedWallet && connectedWallet !== lock.owner) {
    return `
      <div id="lockUnlockSection">
        <p class="form-error" id="unlockWalletMessage" role="alert">
          Only the original locker wallet can unlock this lock.
        </p>
      </div>
    `
  }

  if (!canUnlockLock(lock, connectedWallet, now)) {
    return '<div id="lockUnlockSection"></div>'
  }

  return `
    <div id="lockUnlockSection" class="lock-detail-unlock">
      <p class="form-error" id="unlockErrorMessage" role="alert" hidden></p>
      <button type="button" class="unlock-btn" id="unlockTokensBtn">
        Unlock Tokens
      </button>
    </div>
  `
}

function renderLoadingState(lockAccount: string): string {
  return `
    <main class="app-shell app-shell--simple">
      <section class="main-card" aria-live="polite">
        <p class="empty-state">Loading lock ${escapeHtml(formatWalletAddress(lockAccount, 6))}…</p>
      </section>
    </main>
  `
}

function renderLockDetails(
  lock: LockRecord,
  mintDecimals: number | null,
  connectedWallet: string | null,
  now = Date.now(),
): string {
  const status = getDisplayLockStatus(lock, now)
  const amount = formatLockAmountDisplay(lock, mintDecimals)
  const orbUrl = getOrbAccountUrl(lock.lockAccount, getSelectedNetwork())

  const verificationLabel = lock.onChainVerified
    ? '<p class="certificate-badge">Verified On-Chain</p>'
    : '<p class="certificate-badge certificate-badge--warning">Not verified</p>'

  return `
    <main class="app-shell app-shell--simple">
      <section class="main-card lock-certificate" aria-labelledby="lock-detail-heading">
        <header class="certificate-header">
          <p class="certificate-eyebrow">CBS Token Locker</p>
          <h1 class="certificate-title" id="lock-detail-heading">${escapeHtml(lock.projectName)}</h1>
          ${verificationLabel}
        </header>

        <dl class="certificate-facts">
          <div class="certificate-fact">
            <dt>Amount</dt>
            <dd data-lock-amount-main>${escapeHtml(amount.human)}</dd>
          </div>
          <div class="certificate-fact">
            <dt>Status</dt>
            <dd><span id="lockStatusBadge">${renderLockStatusMarkup(status)}</span></dd>
          </div>
          <div class="certificate-fact">
            <dt>Unlock date</dt>
            <dd id="lockRemainingTime">${escapeHtml(formatDateTime(lock.unlockAt))}</dd>
          </div>
          <div class="certificate-fact">
            <dt>Owner</dt>
            <dd class="mono">${escapeHtml(formatWalletAddress(lock.owner, 6))}</dd>
          </div>
        </dl>

        ${renderUnlockSection(lock, connectedWallet, now)}

        <div class="lock-detail-actions">
          <button type="button" class="primary-btn" id="copyLockLinkBtn">Copy Link</button>
          <a
            class="secondary-btn"
            href="${escapeHtml(orbUrl)}"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on Orb
          </a>
          <a class="secondary-btn" href="/" data-router-link data-app-tab-link="locks">
            Back
          </a>
        </div>

        <details class="advanced-details advanced-details--inline">
          <summary class="advanced-details__summary">Advanced details</summary>
          <div class="advanced-details__content">
            <dl class="detail-list">
              <div class="detail-item">
                <dt>Raw amount</dt>
                <dd class="mono">${escapeHtml(amount.raw)}</dd>
              </div>
              <div class="detail-item">
                <dt>Lock account</dt>
                <dd class="mono">${escapeHtml(lock.lockAccount)}</dd>
              </div>
              <div class="detail-item">
                <dt>Vault account</dt>
                <dd class="mono">${escapeHtml(lock.vault)}</dd>
              </div>
              <div class="detail-item">
                <dt>Token mint</dt>
                <dd class="mono">${escapeHtml(lock.mint)}</dd>
              </div>
              <div class="detail-item">
                <dt>Token type</dt>
                <dd>${escapeHtml(formatTokenType(lock.tokenType))}</dd>
              </div>
              <div class="detail-item">
                <dt>Program ID</dt>
                <dd class="mono">${escapeHtml(lock.programId)}</dd>
              </div>
              ${
                lock.createSignature
                  ? `
                    <div class="detail-item">
                      <dt>Signature</dt>
                      <dd class="mono">${escapeHtml(lock.createSignature)}</dd>
                    </div>
                  `
                  : ''
              }
            </dl>
          </div>
        </details>
      </section>
      ${renderSiteFooter()}
    </main>
  `
}

export function renderLockDetailLoading(lockAccount: string): string {
  return renderLoadingState(lockAccount)
}

export function renderLockDetailPage(context: LockDetailContext, lockAccount: string): string {
  if (!context.lock) {
    return `
      <main class="app-shell app-shell--simple">
        <section class="main-card" aria-labelledby="lock-not-found-heading">
          <h1 class="certificate-title" id="lock-not-found-heading">Lock not found</h1>
          <p class="empty-state__body">
            No lock at <span class="mono">${escapeHtml(formatWalletAddress(lockAccount, 6))}</span>.
          </p>
          <div class="lock-detail-actions">
            <a class="primary-btn" href="/" data-router-link>Home</a>
          </div>
        </section>
        ${renderSiteFooter()}
      </main>
    `
  }

  return renderLockDetails(
    context.lock,
    context.mintDecimals,
    context.connectedWallet,
  )
}

export async function loadLockRecord(lockAccount: string): Promise<LockRecord | null> {
  const onChain = await fetchOnChainLock(lockAccount)

  if (onChain) {
    return onChain
  }

  return fetchLockFromApi(lockAccount)
}

export async function loadLockDetailContext(lockAccount: string): Promise<LockDetailContext> {
  const lock = await loadLockRecord(lockAccount)
  const walletState = getWalletConnectionState()
  let mintDecimals: number | null = null

  if (lock) {
    mintDecimals = await fetchMintDecimalsForLock(lock.mint)

    if (lock.isUnlocked) {
      void inspectLoadedUnlockedLock(lock)
    }
  }

  return {
    lock,
    mintDecimals,
    connectedWallet: walletState.address,
  }
}

export async function inspectLoadedUnlockedLock(lock: LockRecord): Promise<void> {
  if (!lock.isUnlocked) {
    return
  }

  await inspectUnlockedLock(lock)
}

function updateLockDetailLiveState(lock: LockRecord, connectedWallet: string | null): void {
  const now = Date.now()
  const status = getDisplayLockStatus(lock, now)
  const remainingElement = document.querySelector<HTMLElement>('#lockRemainingTime')
  const statusElement = document.querySelector<HTMLElement>('#lockStatusBadge')
  const unlockSection = document.querySelector<HTMLElement>('#lockUnlockSection')

  if (remainingElement) {
    remainingElement.textContent = formatDateTime(lock.unlockAt)
  }

  if (statusElement) {
    statusElement.innerHTML = renderLockStatusMarkup(status)
  }

  if (unlockSection) {
    if (lock.isUnlocked) {
      unlockSection.outerHTML = renderUnlockSection(lock, connectedWallet, now)
    } else {
      unlockSection.outerHTML = renderUnlockSection(lock, connectedWallet, now)

      if (activeLockDetailAccount) {
        attachUnlockHandler(lock, activeLockDetailAccount)
      }
    }
  }
}

function attachUnlockHandler(lock: LockRecord, _lockAccount: string): void {
  const unlockButton = document.querySelector<HTMLButtonElement>('#unlockTokensBtn')

  if (!unlockButton) {
    return
  }

  unlockButton.onclick = async () => {
    const walletState = getWalletConnectionState()

    if (walletState.status !== 'connected' || !walletState.address) {
      return
    }

    unlockButton.disabled = true

    try {
      const updatedLock = await executeUnlockLock(lock)

      activeLockDetailRecord = updatedLock
      showSuccessToast('Tokens unlocked successfully.')
      updateLockDetailLiveState(updatedLock, walletState.address)
    } catch (error) {
      console.error('[CBS Locker] unlock detail page failure', error)
      unlockButton.disabled = false
    }
  }
}

function startLockDetailLiveRefresh(lock: LockRecord, lockAccount: string): void {
  stopLockDetailLiveRefresh()
  activeLockDetailAccount = lockAccount
  activeLockDetailRecord = lock

  const refresh = () => {
    if (!activeLockDetailRecord) {
      return
    }

    updateLockDetailLiveState(
      activeLockDetailRecord,
      getWalletConnectionState().address,
    )
  }

  lockDetailRefreshTimer = setInterval(refresh, LIVE_REFRESH_INTERVAL_MS)
  lockDetailWalletUnsubscribe = subscribeToWalletConnection(() => {
    refresh()
  })
}

export function attachLockDetailHandlers(
  context: LockDetailContext,
  lockAccount: string,
): void {
  attachSiteFooterHandlers()
  const lock = context.lock
  const copyButton = document.querySelector<HTMLButtonElement>('#copyLockLinkBtn')

  if (copyButton && lock) {
    copyButton.addEventListener('click', async () => {
      const url = new URL(getPublicLockPath(lock.lockAccount), window.location.origin).toString()

      try {
        await navigator.clipboard.writeText(url)
        copyButton.textContent = 'Link Copied'
        window.setTimeout(() => {
          copyButton.textContent = 'Copy Lock Link'
        }, 2000)
      } catch {
        copyButton.textContent = 'Copy Failed'
        window.setTimeout(() => {
          copyButton.textContent = 'Copy Lock Link'
        }, 2000)
      }
    })
  }

  if (!lock) {
    return
  }

  attachUnlockHandler(lock, lockAccount)
  startLockDetailLiveRefresh(lock, lockAccount)
}
