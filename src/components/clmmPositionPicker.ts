import { readFormTokenTypeSelect } from './createLockForm'
import { getSelectedNetwork, subscribeToClusterChanges } from '../solana/cluster'
import { scanWalletClmmPositions } from '../solana/walletTokenScan'
import type { ClmmPositionCandidate } from '../types/clmmPosition'
import { escapeHtml } from '../utils/html'
import { formatWalletAddress } from '../utils/format'
import { getWalletConnectionState, subscribeToWalletConnection } from '../wallet'

type PickerViewState =
  | { kind: 'hidden' }
  | { kind: 'disconnected' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'empty' }
  | { kind: 'results'; positions: ClmmPositionCandidate[]; selectedMint: string | null }

let pickerAttached = false
let scanRequestId = 0
let selectedMint: string | null = null
let onFormChange: (() => void) | undefined

function getPickerHost(): HTMLElement | null {
  return document.querySelector<HTMLElement>('#clmmPositionPicker')
}

function getMintInput(): HTMLInputElement | null {
  return document.querySelector<HTMLInputElement>('#tokenMint')
}

function getAmountInput(): HTMLInputElement | null {
  return document.querySelector<HTMLInputElement>('#amount')
}

function isClmmTokenTypeSelected(): boolean {
  const form = document.querySelector<HTMLFormElement>('#createLockForm')
  return readFormTokenTypeSelect(form) === 'clmm'
}

function formatTokenProgramLabel(tokenProgram: ClmmPositionCandidate['tokenProgram']): string {
  return tokenProgram === 'token-2022' ? 'Token-2022' : 'SPL'
}

function renderPositionRow(position: ClmmPositionCandidate, isSelected: boolean): string {
  const checked = isSelected ? ' checked' : ''

  return `
    <label class="clmm-position-picker__item">
      <input
        type="radio"
        name="clmmPositionMint"
        value="${escapeHtml(position.mint)}"
        class="clmm-position-picker__radio"${checked}
      />
      <span class="clmm-position-picker__item-body">
        <span class="clmm-position-picker__mint mono" title="${escapeHtml(position.mint)}">
          ${escapeHtml(formatWalletAddress(position.mint, 6))}
        </span>
        <span class="clmm-position-picker__badge">${escapeHtml(formatTokenProgramLabel(position.tokenProgram))}</span>
      </span>
    </label>
  `
}

function renderPickerMarkup(state: PickerViewState): string {
  if (state.kind === 'hidden') {
    return ''
  }

  if (state.kind === 'disconnected') {
    return `
      <p class="clmm-position-picker__message">
        Connect wallet to scan for CLMM positions.
      </p>
    `
  }

  if (state.kind === 'loading') {
    return `
      <p class="clmm-position-picker__message clmm-position-picker__message--loading">
        Scanning wallet for Raydium CLMM position NFTs…
      </p>
    `
  }

  if (state.kind === 'error') {
    return `
      <p class="clmm-position-picker__message clmm-position-picker__message--error" role="alert">
        ${escapeHtml(state.message)}
      </p>
      <button type="button" class="secondary-btn clmm-position-picker__retry" data-clmm-scan-retry>
        Scan again
      </button>
    `
  }

  if (state.kind === 'empty') {
    return `
      <p class="clmm-position-picker__message">
        No Raydium CLMM position NFTs found in this wallet on ${escapeHtml(getSelectedNetwork() === 'devnet' ? 'Devnet' : 'Mainnet')}.
      </p>
      <button type="button" class="secondary-btn clmm-position-picker__retry" data-clmm-scan-retry>
        Scan again
      </button>
    `
  }

  return `
    <p class="clmm-position-picker__lead">
      Select a Raydium CLMM position NFT from your connected wallet.
    </p>
    <div class="clmm-position-picker__list" role="radiogroup" aria-label="Raydium CLMM positions">
      ${state.positions.map((position) => renderPositionRow(position, state.selectedMint === position.mint)).join('')}
    </div>
    <button type="button" class="secondary-btn clmm-position-picker__retry" data-clmm-scan-retry>
      Scan again
    </button>
  `
}

function renderPicker(state: PickerViewState): void {
  const host = getPickerHost()

  if (!host) {
    return
  }

  if (state.kind === 'hidden') {
    host.hidden = true
    host.innerHTML = ''
    return
  }

  host.hidden = false
  host.innerHTML = `
    <div class="clmm-position-picker__panel">
      <p class="clmm-position-picker__title">Your Raydium CLMM positions</p>
      ${renderPickerMarkup(state)}
    </div>
  `

  host.querySelector('[data-clmm-scan-retry]')?.addEventListener('click', () => {
    void refreshClmmPositionScan()
  })

  host.querySelectorAll<HTMLInputElement>('input[name="clmmPositionMint"]').forEach((input) => {
    input.addEventListener('change', () => {
      if (!input.checked) {
        return
      }

      applyClmmPositionSelection(input.value)
    })
  })
}

function applyClmmPositionSelection(mint: string): void {
  selectedMint = mint

  const mintInput = getMintInput()
  const amountInput = getAmountInput()

  if (mintInput) {
    mintInput.value = mint
    mintInput.dispatchEvent(new Event('input', { bubbles: true }))
  }

  if (amountInput) {
    amountInput.value = '1'
    amountInput.dispatchEvent(new Event('input', { bubbles: true }))
  }

  onFormChange?.()
}

function clearClmmPositionSelection(): void {
  selectedMint = null
}

export async function refreshClmmPositionScan(): Promise<void> {
  if (!isClmmTokenTypeSelected()) {
    renderPicker({ kind: 'hidden' })
    return
  }

  const walletState = getWalletConnectionState()

  if (walletState.status !== 'connected' || !walletState.address) {
    clearClmmPositionSelection()
    renderPicker({ kind: 'disconnected' })
    return
  }

  const requestId = ++scanRequestId
  renderPicker({ kind: 'loading' })

  const result = await scanWalletClmmPositions({
    ownerAddress: walletState.address,
    network: getSelectedNetwork(),
  })

  if (requestId !== scanRequestId || !isClmmTokenTypeSelected()) {
    return
  }

  if (result.kind === 'error') {
    renderPicker({ kind: 'error', message: result.message })
    return
  }

  if (result.positions.length === 0) {
    clearClmmPositionSelection()
    renderPicker({ kind: 'empty' })
    onFormChange?.()
    return
  }

  const stillSelected =
    selectedMint !== null && result.positions.some((position) => position.mint === selectedMint)

  if (!stillSelected) {
    clearClmmPositionSelection()
  }

  renderPicker({
    kind: 'results',
    positions: result.positions,
    selectedMint: stillSelected ? selectedMint : null,
  })

  if (stillSelected && selectedMint) {
    applyClmmPositionSelection(selectedMint)
  }

  onFormChange?.()
}

export function syncClmmPositionPickerVisibility(): void {
  if (!isClmmTokenTypeSelected()) {
    renderPicker({ kind: 'hidden' })
    return
  }

  const walletState = getWalletConnectionState()

  if (walletState.status !== 'connected' || !walletState.address) {
    renderPicker({ kind: 'disconnected' })
    return
  }

  void refreshClmmPositionScan()
}

export function attachClmmPositionPicker(options?: { onFormChange?: () => void }): void {
  onFormChange = options?.onFormChange

  if (pickerAttached) {
    syncClmmPositionPickerVisibility()
    return
  }

  pickerAttached = true
  syncClmmPositionPickerVisibility()

  subscribeToWalletConnection(() => {
    if (!isClmmTokenTypeSelected()) {
      return
    }

    void refreshClmmPositionScan()
  })

  subscribeToClusterChanges(() => {
    if (!isClmmTokenTypeSelected()) {
      return
    }

    clearClmmPositionSelection()
    void refreshClmmPositionScan()
  })
}
