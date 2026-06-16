import { formatTokenAmountFromRaw } from './format'

export function applyBalancePercentage(rawBalance: bigint, percent: number): bigint {
  if (percent >= 100) {
    return rawBalance
  }

  if (rawBalance <= 0n) {
    return 0n
  }

  return (rawBalance * BigInt(percent)) / 100n
}

export function rawBalanceToInputAmount(rawAmount: bigint, decimals: number): string {
  return formatTokenAmountFromRaw(rawAmount.toString(), decimals).replaceAll(',', '')
}

export function formatAvailableBalance(rawAmount: bigint, decimals: number): string {
  return formatTokenAmountFromRaw(rawAmount.toString(), decimals)
}
