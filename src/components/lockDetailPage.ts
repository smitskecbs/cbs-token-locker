import { getPublicLockPath } from '../locker'
import { fetchLockFromApi } from '../services/lockApi'
import { getSelectedNetwork } from '../solana/cluster'
import { getOrbAccountUrl } from '../solana/config'
import { fetchOnChainLock } from '../solana/client'
import { fetchMintDecimalsForLock } from '../solana/mintDecimals'
import { inspectUnlockedLock } from '../solana/unlockVerification'
import { LIVE_REFRESH_INTERVAL_MS } from '../state/rpcActivityStore'
import { CBS_LOCKER_PROGRAM_ID } from '../solana/programId'
import type { LockRecord } from '../types/lock'
import { formatDateTime, formatTokenType, formatWalletAddress } from '../utils/format'
import { escapeHtml } from '../utils/html'
import {
  canUnlockLock,
  formatLockAmountDisplay,
  formatRemainingTime,
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
import { renderSafetyNotice } from './safetyNotice'
import { renderDexRecognitionNotice, renderVerificationBadge } from './verificationBadge'
import { renderSiteFooter } from './siteFooter'

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
    return ''
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
      <p id="unlockSuccessMessage" role="status" hidden></p>
      <p class="form-error" id="unlockErrorMessage" role="alert" hidden></p>
      <button type="button" class="unlock-btn" id="unlockTokensBtn">
        Unlock Tokens
      </button>
    </div>
  `
}

function renderLoadingState(lockAccount: string): string {
  return `
    <main class="app-shell">
      <section class="hero-card" aria-live="polite">
        <p class="hero-eyebrow">Verifying on-chain lock</p>
        <h1 class="hero-title">Loading Lock Explorer</h1>
        <p class="hero-text">
          Reading lock account
          <span class="mono">${escapeHtml(formatWalletAddress(lockAccount, 8))}</span>
          directly from Solana.
        </p>
      </section>
    </main>
  `
}

function renderUnverifiedNotice(): string {
  return `
    <div class="verification-warning" role="alert">
      This lock could not be verified on-chain.
    </div>
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

  const verificationMarkup = lock.onChainVerified
    ? `${renderVerificationBadge(true, 'CBS verified on-chain')}${renderDexRecognitionNotice()}`
    : renderUnverifiedNotice()

  return `
    <main class="app-shell">
      <section class="hero-card lock-detail-card" aria-labelledby="lock-detail-heading">
        <p class="hero-eyebrow">On-chain Lock Explorer</p>
        <h1 class="hero-title lock-detail-title" id="lock-detail-heading">
          ${escapeHtml(lock.projectName)}
        </h1>
        <p class="lock-detail-id">
          Lock Account:
          <span class="mono">${escapeHtml(lock.lockAccount)}</span>
        </p>
        ${verificationMarkup}

        <dl class="detail-list detail-list--spacious">
          <div class="detail-item">
            <dt>Program ID</dt>
            <dd class="mono">${escapeHtml(lock.programId)}</dd>
          </div>
          <div class="detail-item">
            <dt>Token Mint</dt>
            <dd class="mono">${escapeHtml(lock.mint)}</dd>
          </div>
          <div class="detail-item">
            <dt>Token Type</dt>
            <dd>${escapeHtml(formatTokenType(lock.tokenType))}</dd>
          </div>
          <div class="detail-item">
            <dt>Locked Amount</dt>
            <dd>
              ${escapeHtml(amount.human)}
              <br>
              <small>Raw amount: ${escapeHtml(amount.raw)}</small>
            </dd>
          </div>
          <div class="detail-item">
            <dt>Vault Account</dt>
            <dd class="mono">${escapeHtml(lock.vault)}</dd>
          </div>
          <div class="detail-item">
            <dt>Locker Wallet</dt>
            <dd class="mono">${escapeHtml(formatWalletAddress(lock.owner, 8))}</dd>
          </div>
          <div class="detail-item">
            <dt>Creation Date</dt>
            <dd>${escapeHtml(formatDateTime(lock.createdAt))}</dd>
          </div>
          <div class="detail-item">
            <dt>Unlock Date</dt>
            <dd>${escapeHtml(formatDateTime(lock.unlockAt))}</dd>
          </div>
          <div class="detail-item">
            <dt>Remaining Time</dt>
            <dd id="lockRemainingTime">${escapeHtml(formatRemainingTime(lock.unlockAt, now, lock.isUnlocked))}</dd>
          </div>
          <div class="detail-item">
            <dt>Current Status</dt>
            <dd>
              <span id="lockStatusBadge">
                ${renderLockStatusMarkup(status)}
              </span>
            </dd>
          </div>
          ${
            lock.createSignature
              ? `
                <div class="detail-item">
                  <dt>Create Signature</dt>
                  <dd class="mono">${escapeHtml(lock.createSignature)}</dd>
                </div>
              `
              : ''
          }
        </dl>

        ${renderUnlockSection(lock, connectedWallet, now)}

        <div class="lock-detail-actions">
          <button type="button" class="primary-btn" id="copyLockLinkBtn">
            Copy Link
          </button>
          <a
            class="secondary-btn"
            href="${escapeHtml(orbUrl)}"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on Orb
          </a>
          <a class="secondary-btn" href="/" data-router-link>
            Back to Home
          </a>
        </div>
      </section>

      ${renderSafetyNotice(`lock-${lock.lockAccount}`)}
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
      <main class="app-shell">
        <section class="hero-card" aria-labelledby="lock-not-found-heading">
          <h1 class="hero-title" id="lock-not-found-heading">On-chain Lock Not Found</h1>
          <p class="hero-text">
            No CBS Token Locker account was found at
            <strong class="mono">${escapeHtml(lockAccount)}</strong>
            for program
            <strong class="mono">${escapeHtml(CBS_LOCKER_PROGRAM_ID)}</strong>.
          </p>
          <div class="hero-actions">
            <a class="primary-btn" href="/locks" data-router-link>
              Search Public Locks
            </a>
            <a class="secondary-btn" href="/" data-router-link>
              Back to Home
            </a>
          </div>
        </section>
        ${renderSafetyNotice('not-found')}
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
    remainingElement.textContent = formatRemainingTime(lock.unlockAt, now, lock.isUnlocked)
  }

  if (statusElement) {
    statusElement.innerHTML = renderLockStatusMarkup(status)
  }

  if (unlockSection) {
    if (lock.isUnlocked) {
      unlockSection.outerHTML = '<div id="lockUnlockSection"></div>'
    } else {
      unlockSection.outerHTML = renderUnlockSection(lock, connectedWallet, now)

      if (activeLockDetailAccount) {
        attachUnlockHandler(lock, activeLockDetailAccount)
      }
    }
  }
}

function attachUnlockHandler(lock: LockRecord, lockAccount: string): void {
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
  const lock = context.lock
  const copyButton = document.querySelector<HTMLButtonElement>('#copyLockLinkBtn')

  if (copyButton && lock) {
    copyButton.addEventListener('click', async () => {
      const url = new URL(getPublicLockPath(lock.lockAccount), window.location.origin).toString()

      try {
        await navigator.clipboard.writeText(url)
        copyButton.textContent = 'Link Copied'
        window.setTimeout(() => {
          copyButton.textContent = 'Copy Link'
        }, 2000)
      } catch {
        copyButton.textContent = 'Copy Failed'
        window.setTimeout(() => {
          copyButton.textContent = 'Copy Link'
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
