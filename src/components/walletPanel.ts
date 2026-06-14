import {
  detectAvailableWallets,
  getWalletConnectionState,
} from '../wallet'
import { escapeHtml } from '../utils/html'
import { formatWalletAddress } from '../utils/format'
import { renderWalletNetworkSection } from './clusterPanel'

export function renderWalletBar(): string {
  const wallets = detectAvailableWallets()
  const state = getWalletConnectionState()

  const walletOptions = wallets
    .map((wallet) => {
      const selected = wallet.id === state.walletId ? ' selected' : ''
      return `<option value="${escapeHtml(wallet.id)}"${selected}>${escapeHtml(wallet.name)}</option>`
    })
    .join('')

  const connectedAddress =
    state.status === 'connected' && state.address
      ? `
        <p class="wallet-bar__connected-label">Connected</p>
        <p class="wallet-bar__address mono" title="${escapeHtml(state.address)}">${escapeHtml(formatWalletAddress(state.address, 4))}</p>
      `
      : ''

  const disconnectButton =
    state.status === 'connected'
      ? `
        <button
          type="button"
          class="secondary-btn wallet-bar__disconnect"
          id="disconnectWalletBtn"
        >
          Disconnect
        </button>
      `
      : ''

  const errorMessage = state.errorMessage
    ? `<p class="form-error wallet-bar__error" role="alert">${escapeHtml(state.errorMessage)}</p>`
    : ''

  return `
    <div class="wallet-bar" id="wallet-bar">
      <div class="wallet-bar__controls">
        <div class="wallet-bar__section">
          <p class="wallet-bar__section-label">Wallet</p>
          <select
            class="wallet-bar__select"
            id="walletSelect"
            aria-label="Select wallet"
            ${wallets.length === 0 ? 'disabled' : ''}
          >
            ${walletOptions || '<option value="">No wallet</option>'}
          </select>
        </div>

        <div class="wallet-bar__section wallet-bar__section--network" id="wallet-network-section">
          <p class="wallet-bar__section-label">Network</p>
          ${renderWalletNetworkSection()}
        </div>
      </div>

      <button
        type="button"
        class="primary-btn wallet-bar__connect"
        id="connectWalletBtn"
        ${wallets.length === 0 ? 'disabled' : ''}
      >
        Connect
      </button>

      ${connectedAddress}
      ${disconnectButton}
      ${errorMessage}
    </div>
  `
}

/** @deprecated Use renderWalletBar */
export function renderWalletPanel(): string {
  return `
    <section class="page-section wallet-panel" id="wallet">
      ${renderWalletBar()}
    </section>
  `
}
