import {
  detectAvailableWallets,
  getWalletConnectionState,
  type WalletConnectionState,
} from '../wallet'
import { escapeHtml } from '../utils/html'
import { formatWalletAddress } from '../utils/format'

function renderWalletStatus(state: WalletConnectionState): string {
  if (state.status === 'connected' && state.address) {
    return `
      <div class="wallet-status wallet-status--connected">
        <span class="wallet-status__dot" aria-hidden="true"></span>
        Connected
      </div>
    `
  }

  if (state.status === 'connecting') {
    return `
      <div class="wallet-status wallet-status--connecting">
        <span class="wallet-status__dot" aria-hidden="true"></span>
        Connecting…
      </div>
    `
  }

  if (state.status === 'error') {
    return `
      <div class="wallet-status wallet-status--error">
        <span class="wallet-status__dot" aria-hidden="true"></span>
        Connection failed
      </div>
    `
  }

  return `
    <div class="wallet-status wallet-status--disconnected">
      <span class="wallet-status__dot" aria-hidden="true"></span>
      Not connected
    </div>
  `
}

export function renderWalletPanel(): string {
  const wallets = detectAvailableWallets()
  const state = getWalletConnectionState()

  const walletOptions = wallets
    .map((wallet) => {
      const selected = wallet.id === state.walletId ? ' selected' : ''

      return `<option value="${escapeHtml(wallet.id)}"${selected}>${escapeHtml(wallet.name)}</option>`
    })
    .join('')

  const connectedDetails =
    state.status === 'connected' && state.address
      ? `
        <div class="wallet-details">
          <div class="wallet-detail">
            <span class="field-label">Wallet Address</span>
            <span class="wallet-address" title="${escapeHtml(state.address)}">
              ${escapeHtml(formatWalletAddress(state.address, 6))}
            </span>
          </div>
          <div class="wallet-detail">
            <span class="field-label">Provider</span>
            <span>${escapeHtml(state.walletName ?? 'Unknown')}</span>
          </div>
        </div>
      `
      : ''

  const errorMessage = state.errorMessage
    ? `<p class="form-error" role="alert">${escapeHtml(state.errorMessage)}</p>`
    : ''

  const noWalletsMessage =
    wallets.length === 0
      ? `
        <p class="wallet-empty-message">
          No Solana wallets detected. Install a compatible wallet extension or
          open this page in a wallet browser.
        </p>
      `
      : ''

  return `
    <section
      class="page-section wallet-panel"
      id="wallet"
      aria-labelledby="wallet-heading"
    >
      <h2 class="section-title" id="wallet-heading">Wallet Connection</h2>
      <div class="panel-card">
        <p class="panel-lead">
          Connect any compatible Solana wallet through the Wallet Standard.
          CBS Token Locker supports Phantom, Solflare, Backpack, Glow, Exodus,
          Trust Wallet, and future Solana wallets.
        </p>

        ${renderWalletStatus(state)}

        <label class="field">
          <span class="field-label">Select Wallet</span>
          <select
            class="field-input field-select"
            id="walletSelect"
            ${wallets.length === 0 ? 'disabled' : ''}
          >
            ${walletOptions || '<option value="">No wallets detected</option>'}
          </select>
        </label>

        <div class="wallet-actions">
          <button
            type="button"
            class="primary-btn"
            id="connectWalletBtn"
            ${wallets.length === 0 ? 'disabled' : ''}
          >
            Connect Wallet
          </button>
          <button
            type="button"
            class="secondary-btn"
            id="disconnectWalletBtn"
            ${state.status === 'connected' ? '' : 'disabled'}
          >
            Disconnect
          </button>
        </div>

        ${connectedDetails}
        ${errorMessage}
        ${noWalletsMessage}
      </div>
    </section>
  `
}
