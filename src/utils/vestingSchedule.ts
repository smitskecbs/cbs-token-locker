import type { SplitLockInterval } from '../types/splitLock'
import { formatTokenAmountFromRaw } from './format'

export const SPLIT_LOCK_MIN_UNLOCKS = 2
export const SPLIT_LOCK_MAX_UNLOCKS = 12

export function formatDateInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function formatTimeInput(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${hours}:${minutes}`
}

export function addSplitInterval(
  base: Date,
  interval: SplitLockInterval,
  stepIndex: number,
): Date {
  const result = new Date(base)

  if (interval === 'monthly') {
    result.setMonth(result.getMonth() + stepIndex)
  } else {
    result.setFullYear(result.getFullYear() + stepIndex)
  }

  return result
}

export function humanAmountToRaw(amount: string, decimals: number): bigint {
  const trimmed = amount.replaceAll(',', '').trim()

  if (!trimmed) {
    return 0n
  }

  const [wholePart, fracPart = ''] = trimmed.split('.')
  const whole = wholePart === '' ? '0' : wholePart

  if (decimals <= 0) {
    return BigInt(whole)
  }

  const frac = fracPart.padEnd(decimals, '0').slice(0, decimals)

  return BigInt(`${whole}${frac}`)
}

export function rawAmountToHumanInput(rawAmount: bigint, decimals: number): string {
  return formatTokenAmountFromRaw(rawAmount.toString(), decimals).replaceAll(',', '')
}

export function splitRawAmount(totalRaw: bigint, unlockCount: number): bigint[] {
  if (unlockCount < 1 || totalRaw < 0n) {
    return []
  }

  const divisor = BigInt(unlockCount)
  const base = totalRaw / divisor
  const remainder = totalRaw % divisor
  const amounts: bigint[] = []

  for (let index = 0; index < unlockCount; index += 1) {
    amounts.push(index === unlockCount - 1 ? base + remainder : base)
  }

  return amounts
}

export function equalPercentLabel(unlockCount: number): string {
  const pct = 100 / unlockCount
  const rounded = Number.isInteger(pct) ? String(pct) : pct.toFixed(2).replace(/\.?0+$/, '')

  return `${rounded}%`
}

export function trancheProjectName(baseName: string, index: number, total: number): string {
  const suffix = ` (${index}/${total})`
  const maxBaseLength = 48 - suffix.length

  return `${baseName.trim().slice(0, maxBaseLength)}${suffix}`
}
