import { isValidSolanaAddress } from '../locker'
import { readLockMode, readFormTokenTypeSelect } from '../components/createLockForm'
import { getSelectedNetwork } from '../solana/cluster'
import { getProgramStatus } from '../state/programStore'
import type { LockMode } from '../types/splitLock'
import { getWalletConnectionState } from '../wallet'
import {
  SPLIT_LOCK_MAX_UNLOCKS,
  SPLIT_LOCK_MIN_UNLOCKS,
} from './vestingSchedule'
import { combineUnlockDateTime } from './time'

export type CreateLockFormState = {
  lockMode: LockMode
  walletConnected: boolean
  programDeployed: boolean
  safetyChecked: boolean
  projectNameValid: boolean
  mintValid: boolean
  amountValid: boolean
  unlockDateValid: boolean
  splitUnlockCountValid: boolean
  clmmSelected: boolean
  canPreview: boolean
  canCreate: boolean
  disableReasons: string[]
}

export function readCreateLockFormState(form: HTMLFormElement | null): CreateLockFormState {
  const walletState = getWalletConnectionState()
  const selectedNetwork = getSelectedNetwork()
  const programStatus = getProgramStatus()
  const programStatusMatchesNetwork = programStatus.cluster === selectedNetwork
  const formData = form ? new FormData(form) : null
  const lockMode = readLockMode(form)
  const tokenTypeSelect = readFormTokenTypeSelect(form)
  const clmmSelected = tokenTypeSelect === 'clmm'

  const projectName = String(formData?.get('projectName') ?? '').trim()
  const tokenMint = String(formData?.get('tokenMint') ?? '').trim()
  const amount = String(formData?.get('amount') ?? '').trim()
  const unlockDate = String(formData?.get('unlockDate') ?? '').trim()
  const unlockTime = String(formData?.get('unlockTime') ?? '').trim()
  const splitUnlockCount = Number(formData?.get('splitUnlockCount') ?? '')
  const splitFirstUnlockDate = String(formData?.get('splitFirstUnlockDate') ?? '').trim()
  const splitFirstUnlockTime = String(formData?.get('splitFirstUnlockTime') ?? '').trim()
  const safetyChecked = Boolean(form?.querySelector<HTMLInputElement>('#safetyAcknowledgement')?.checked)

  const walletConnected = walletState.status === 'connected' && Boolean(walletState.address)
  const programVerificationUnavailable =
    programStatusMatchesNetwork && !programStatus.loading && !programStatus.statusKnown
  const programDeployed =
    programStatusMatchesNetwork &&
    programStatus.statusKnown &&
    programStatus.deployed &&
    !programStatus.loading
  const projectNameValid = projectName.length > 0
  const mintValid = isValidSolanaAddress(tokenMint)
  const numericAmount = Number(amount.replaceAll(',', ''))
  const amountValid = Number.isFinite(numericAmount) && numericAmount > 0

  let unlockDateValid = false

  if (lockMode === 'single') {
    if (unlockDate && unlockTime) {
      const unlockAt = combineUnlockDateTime(unlockDate, unlockTime)
      unlockDateValid =
        !Number.isNaN(new Date(unlockAt).getTime()) && new Date(unlockAt).getTime() > Date.now()
    }
  } else if (splitFirstUnlockDate && splitFirstUnlockTime) {
    const firstUnlockAt = combineUnlockDateTime(splitFirstUnlockDate, splitFirstUnlockTime)
    unlockDateValid =
      !Number.isNaN(new Date(firstUnlockAt).getTime()) &&
      new Date(firstUnlockAt).getTime() > Date.now()
  }

  const splitUnlockCountValid =
    lockMode === 'single' ||
    (Number.isInteger(splitUnlockCount) &&
      splitUnlockCount >= SPLIT_LOCK_MIN_UNLOCKS &&
      splitUnlockCount <= SPLIT_LOCK_MAX_UNLOCKS)

  const disableReasons: string[] = []

  if (!walletConnected) {
    disableReasons.push('Connect a wallet.')
  }

  if (programVerificationUnavailable && programStatus.error) {
    disableReasons.push(programStatus.error)
  } else if (!programDeployed && !programStatus.loading && programStatusMatchesNetwork) {
    disableReasons.push(`Deploy the CBS Locker Program on ${selectedNetwork === 'mainnet' ? 'Mainnet' : 'Devnet'}.`)
  }

  if (!projectNameValid) {
    disableReasons.push('Enter a project name.')
  }

  if (!mintValid) {
    disableReasons.push('Enter a valid token mint address.')
  }

  if (!amountValid) {
    disableReasons.push(
      lockMode === 'split'
        ? 'Enter a valid total amount greater than zero.'
        : 'Enter a valid amount greater than zero.',
    )
  }

  if (!unlockDateValid) {
    disableReasons.push(
      lockMode === 'split'
        ? 'Choose a future first unlock date and time.'
        : 'Choose a future unlock date and time.',
    )
  }

  if (!splitUnlockCountValid) {
    disableReasons.push(
      `Number of unlocks must be between ${SPLIT_LOCK_MIN_UNLOCKS} and ${SPLIT_LOCK_MAX_UNLOCKS}.`,
    )
  }

  if (!safetyChecked) {
    disableReasons.push('Acknowledge the safety notice.')
  }

  if (clmmSelected) {
    disableReasons.push('CLMM Position NFT locking is coming soon.')
  }

  const formValid =
    projectNameValid &&
    mintValid &&
    amountValid &&
    unlockDateValid &&
    splitUnlockCountValid &&
    safetyChecked &&
    !clmmSelected

  const canPreview = walletConnected && formValid
  const canCreate = canPreview && programDeployed

  return {
    lockMode,
    walletConnected,
    programDeployed,
    safetyChecked,
    projectNameValid,
    mintValid,
    amountValid,
    unlockDateValid,
    splitUnlockCountValid,
    clmmSelected,
    canPreview,
    canCreate,
    disableReasons,
  }
}
