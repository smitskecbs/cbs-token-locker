import { fetchOwnerTokenBalance } from '../solana/tokenBalance'
import { isValidSolanaAddress } from '../locker'
import { getWalletConnectionState, subscribeToWalletConnection } from '../wallet'
import {
  applyBalancePercentage,
  formatAvailableBalance,
  rawBalanceToInputAmount,
} from '../utils/amountShortcuts'

let amountShortcutsAttached = false
let balanceCacheKey: string | null = null
let balanceCache:
  | {
      rawAmount: bigint
      decimals: number
    }
  | null = null
let balanceFetchId = 0

function getMintInput(): HTMLInputElement | null {
  return document.querySelector<HTMLInputElement>('#tokenMint')
}

function getAmountInput(): HTMLInputElement | null {
  return document.querySelector<HTMLInputElement>('#amount')
}

function getAvailableElement(): HTMLElement | null {
  return document.querySelector<HTMLElement>('#amountAvailableBalance')
}

function getFeedbackElement(): HTMLElement | null {
  return document.querySelector<HTMLElement>('#amountShortcutsFeedback')
}

function setFeedback(message: string): void {
  const feedback = getFeedbackElement()

  if (!feedback) {
    return
  }

  feedback.textContent = message
  feedback.hidden = message.length === 0
}

function setAvailableBalance(text: string | null): void {
  const available = getAvailableElement()

  if (!available) {
    return
  }

  if (!text) {
    available.hidden = true
    available.textContent = ''
    return
  }

  available.textContent = `Available: ${text}`
  available.hidden = false
}

function clearBalanceCache(): void {
  balanceCacheKey = null
  balanceCache = null
}

function readShortcutContext(): {
  walletAddress: string | null
  mintAddress: string
} {
  const walletState = getWalletConnectionState()
  const mintAddress = getMintInput()?.value.trim() ?? ''

  return {
    walletAddress: walletState.status === 'connected' ? walletState.address ?? null : null,
    mintAddress,
  }
}

async function loadBalance(force = false): Promise<
  | { kind: 'success'; rawAmount: bigint; decimals: number }
  | { kind: 'mint_not_found' }
  | { kind: 'load_failed' }
  | { kind: 'wallet_required' }
  | { kind: 'mint_required' }
  | { kind: 'invalid_mint' }
> {
  const { walletAddress, mintAddress } = readShortcutContext()

  if (!mintAddress) {
    return { kind: 'mint_required' }
  }

  if (!isValidSolanaAddress(mintAddress)) {
    return { kind: 'invalid_mint' }
  }

  if (!walletAddress) {
    return { kind: 'wallet_required' }
  }

  const cacheKey = `${walletAddress}:${mintAddress}`

  if (!force && balanceCacheKey === cacheKey && balanceCache) {
    return {
      kind: 'success',
      rawAmount: balanceCache.rawAmount,
      decimals: balanceCache.decimals,
    }
  }

  const result = await fetchOwnerTokenBalance({
    ownerAddress: walletAddress,
    mintAddress,
  })

  if (result.kind !== 'success') {
    return result
  }

  balanceCacheKey = cacheKey
  balanceCache = {
    rawAmount: result.rawAmount,
    decimals: result.decimals,
  }

  return result
}

async function refreshAvailableBalanceDisplay(): Promise<void> {
  const fetchId = ++balanceFetchId
  const { walletAddress, mintAddress } = readShortcutContext()

  if (!mintAddress || !walletAddress) {
    setAvailableBalance(null)
    setFeedback('')
    return
  }

  if (!isValidSolanaAddress(mintAddress)) {
    setAvailableBalance(null)
    setFeedback('')
    return
  }

  const result = await loadBalance()

  if (fetchId !== balanceFetchId) {
    return
  }

  if (result.kind === 'wallet_required' || result.kind === 'mint_required' || result.kind === 'invalid_mint') {
    setAvailableBalance(null)
    return
  }

  if (result.kind === 'mint_not_found' || result.kind === 'load_failed') {
    setAvailableBalance(null)
    return
  }

  setAvailableBalance(formatAvailableBalance(result.rawAmount, result.decimals))
}

async function applyAmountShortcut(percent: number, onAmountChange?: () => void): Promise<void> {
  const { walletAddress, mintAddress } = readShortcutContext()

  if (!mintAddress) {
    setFeedback('Enter a token mint first.')
    return
  }

  if (!walletAddress) {
    setFeedback('Connect your wallet first.')
    return
  }

  if (!isValidSolanaAddress(mintAddress)) {
    setFeedback('Enter a token mint first.')
    return
  }

  setFeedback('Loading balance…')

  const result = await loadBalance(true)

  if (result.kind === 'mint_not_found' || result.kind === 'load_failed') {
    setFeedback('Token balance could not be loaded.')
    setAvailableBalance(null)
    return
  }

  if (result.kind === 'wallet_required') {
    setFeedback('Connect your wallet first.')
    return
  }

  if (result.kind === 'mint_required' || result.kind === 'invalid_mint') {
    setFeedback('Enter a token mint first.')
    return
  }

  if (result.rawAmount <= 0n) {
    setFeedback('No balance found for this token.')
    setAvailableBalance(formatAvailableBalance(0n, result.decimals))
    return
  }

  const targetRaw = applyBalancePercentage(result.rawAmount, percent)
  const amountInput = getAmountInput()

  if (!amountInput) {
    return
  }

  if (targetRaw <= 0n) {
    setFeedback('Amount too small for this percentage.')
    setAvailableBalance(formatAvailableBalance(result.rawAmount, result.decimals))
    return
  }

  amountInput.value = rawBalanceToInputAmount(targetRaw, result.decimals)
  setAvailableBalance(formatAvailableBalance(result.rawAmount, result.decimals))
  setFeedback('')
  amountInput.dispatchEvent(new Event('input', { bubbles: true }))
  onAmountChange?.()
}

export function attachCreateLockAmountShortcuts(onAmountChange?: () => void): void {
  if (amountShortcutsAttached) {
    return
  }

  amountShortcutsAttached = true

  const mintInput = getMintInput()
  let mintDebounce: ReturnType<typeof setTimeout> | null = null

  mintInput?.addEventListener('input', () => {
    clearBalanceCache()
    setFeedback('')

    if (mintDebounce) {
      clearTimeout(mintDebounce)
    }

    mintDebounce = setTimeout(() => {
      void refreshAvailableBalanceDisplay()
    }, 400)
  })

  mintInput?.addEventListener('change', () => {
    clearBalanceCache()
    void refreshAvailableBalanceDisplay()
  })

  document.querySelector('[data-amount-shortcuts]')?.addEventListener('click', (event) => {
    const target = event.target

    if (!(target instanceof HTMLElement)) {
      return
    }

    const button = target.closest<HTMLButtonElement>('[data-amount-pct]')

    if (!button || button.disabled) {
      return
    }

    event.preventDefault()

    const percentValue = button.dataset.amountPct

    if (!percentValue) {
      return
    }

    const percent = percentValue === 'max' ? 100 : Number(percentValue)

    if (!Number.isFinite(percent) || percent <= 0) {
      return
    }

    void applyAmountShortcut(percent, onAmountChange)
  })

  subscribeToWalletConnection(() => {
    clearBalanceCache()
    setFeedback('')
    void refreshAvailableBalanceDisplay()
  })

  void refreshAvailableBalanceDisplay()
}
