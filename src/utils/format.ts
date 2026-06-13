import type { TokenType } from '../types/lock'

export function formatTokenType(tokenType: TokenType): string {
  return tokenType === 'lp' ? 'LP Token' : 'SPL Token'
}

export function formatWalletAddress(
  address: string,
  visibleChars = 4,
): string {
  const trimmed = address.trim()

  if (trimmed.length <= visibleChars * 2 + 3) {
    return trimmed
  }

  return `${trimmed.slice(0, visibleChars)}…${trimmed.slice(-visibleChars)}`
}

export function formatAmount(amount: string): string {
  const trimmed = amount.trim()

  if (!trimmed) {
    return '0'
  }

  const numeric = Number(trimmed.replaceAll(',', ''))

  if (!Number.isFinite(numeric)) {
    return trimmed
  }

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 9,
  }).format(numeric)
}

export function formatTokenAmountFromRaw(rawAmount: string, decimals: number): string {
  const trimmed = rawAmount.replaceAll(',', '').trim()

  if (!trimmed) {
    return '0'
  }

  if (!/^\d+$/.test(trimmed)) {
    return trimmed
  }

  if (decimals <= 0) {
    return formatAmount(trimmed)
  }

  const raw = BigInt(trimmed)
  const divisor = 10n ** BigInt(decimals)
  const whole = raw / divisor
  const fraction = raw % divisor

  if (fraction === 0n) {
    return formatAmount(whole.toString())
  }

  const fractionText = fraction
    .toString()
    .padStart(decimals, '0')
    .replace(/0+$/, '')

  return `${formatAmount(whole.toString())}.${fractionText}`
}

export function formatDateTime(isoDate: string): string {
  const date = new Date(isoDate)

  if (Number.isNaN(date.getTime())) {
    return isoDate
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}
