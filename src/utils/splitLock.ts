import { LockerValidationError } from '../locker'
import type { CreateLockInput, TokenType } from '../types/lock'
import type { SplitLockInput, SplitLockPreview, SplitLockTranche } from '../types/splitLock'
import { combineUnlockDateTime } from './time'
import {
  addSplitInterval,
  equalPercentLabel,
  formatDateInput,
  formatTimeInput,
  humanAmountToRaw,
  rawAmountToHumanInput,
  SPLIT_LOCK_MAX_UNLOCKS,
  SPLIT_LOCK_MIN_UNLOCKS,
  splitRawAmount,
  trancheProjectName,
} from './vestingSchedule'

function assertSplOrLp(tokenType: TokenType): void {
  if (tokenType !== 'spl' && tokenType !== 'lp') {
    throw new LockerValidationError('Choose SPL Token or LP Token.')
  }
}

export function validateSplitLockInput(input: SplitLockInput, mintDecimals: number): void {
  if (!input.projectName.trim()) {
    throw new LockerValidationError('Project name is required.')
  }

  if (!input.tokenMint.trim()) {
    throw new LockerValidationError('Enter a valid token mint address.')
  }

  assertSplOrLp(input.tokenType)

  const totalAmount = Number(input.totalAmount.replaceAll(',', '').trim())

  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw new LockerValidationError('Enter a valid total amount greater than zero.')
  }

  if (
    !Number.isInteger(input.unlockCount) ||
    input.unlockCount < SPLIT_LOCK_MIN_UNLOCKS ||
    input.unlockCount > SPLIT_LOCK_MAX_UNLOCKS
  ) {
    throw new LockerValidationError(
      `Number of unlocks must be between ${SPLIT_LOCK_MIN_UNLOCKS} and ${SPLIT_LOCK_MAX_UNLOCKS}.`,
    )
  }

  if (input.interval !== 'monthly' && input.interval !== 'yearly') {
    throw new LockerValidationError('Choose a valid unlock interval.')
  }

  if (!input.firstUnlockDate.trim() || !input.firstUnlockTime.trim()) {
    throw new LockerValidationError('First unlock date and time are required.')
  }

  const firstUnlockAt = combineUnlockDateTime(input.firstUnlockDate, input.firstUnlockTime)

  if (Number.isNaN(new Date(firstUnlockAt).getTime())) {
    throw new LockerValidationError('First unlock date and time are invalid.')
  }

  if (new Date(firstUnlockAt).getTime() <= Date.now()) {
    throw new LockerValidationError('First unlock date must be in the future.')
  }

  if (!input.lockerWallet.trim()) {
    throw new LockerValidationError('Connect a wallet before creating on-chain locks.')
  }

  if (!Number.isInteger(mintDecimals) || mintDecimals < 0) {
    throw new LockerValidationError('Token mint decimals could not be loaded.')
  }

  const totalRaw = humanAmountToRaw(input.totalAmount, mintDecimals)

  if (totalRaw <= 0n) {
    throw new LockerValidationError('Total amount is too small for this token.')
  }

  const trancheAmounts = splitRawAmount(totalRaw, input.unlockCount)

  if (trancheAmounts.some((amount) => amount <= 0n)) {
    throw new LockerValidationError(
      'Total amount is too small to split evenly across the selected number of unlocks.',
    )
  }
}

export function buildSplitLockTranches(
  input: SplitLockInput,
  mintDecimals: number,
): SplitLockTranche[] {
  validateSplitLockInput(input, mintDecimals)

  const totalRaw = humanAmountToRaw(input.totalAmount, mintDecimals)
  const rawAmounts = splitRawAmount(totalRaw, input.unlockCount)
  const percentLabel = equalPercentLabel(input.unlockCount)
  const firstUnlockBase = new Date(
    combineUnlockDateTime(input.firstUnlockDate, input.firstUnlockTime),
  )

  return rawAmounts.map((rawAmount, index) => {
    const unlockDateTime = addSplitInterval(firstUnlockBase, input.interval, index)
    const unlockDate = formatDateInput(unlockDateTime)
    const unlockTime = formatTimeInput(unlockDateTime)

    return {
      index: index + 1,
      amount: rawAmountToHumanInput(rawAmount, mintDecimals),
      unlockDate,
      unlockTime,
      unlockAt: combineUnlockDateTime(unlockDate, unlockTime),
      percentLabel,
      projectName: trancheProjectName(input.projectName, index + 1, input.unlockCount),
    }
  })
}

export function buildSplitLockPreview(
  input: SplitLockInput,
  mintDecimals: number,
): SplitLockPreview {
  const tranches = buildSplitLockTranches(input, mintDecimals)

  return {
    mode: 'split',
    projectName: input.projectName.trim(),
    tokenMint: input.tokenMint.trim(),
    tokenType: input.tokenType,
    totalAmount: input.totalAmount.trim(),
    lockerWallet: input.lockerWallet.trim(),
    unlockCount: input.unlockCount,
    interval: input.interval,
    tranches,
  }
}

export function splitLockToCreateLockInputs(
  input: SplitLockInput,
  mintDecimals: number,
): CreateLockInput[] {
  const tranches = buildSplitLockTranches(input, mintDecimals)

  return tranches.map((tranche) => ({
    projectName: tranche.projectName,
    projectDescription: input.projectDescription,
    tokenMint: input.tokenMint.trim(),
    tokenType: input.tokenType,
    amount: tranche.amount,
    lockerWallet: input.lockerWallet,
    unlockDate: tranche.unlockDate,
    unlockTime: tranche.unlockTime,
  }))
}
