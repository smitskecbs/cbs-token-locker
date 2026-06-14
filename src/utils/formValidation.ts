import { isValidSolanaAddress } from '../locker'
import { getSelectedNetwork } from '../solana/cluster'
import { getProgramStatus } from '../state/programStore'
import { getWalletConnectionState } from '../wallet'
import { combineUnlockDateTime } from './time'

export type CreateLockFormState = {
  walletConnected: boolean
  programDeployed: boolean
  safetyChecked: boolean
  projectNameValid: boolean
  mintValid: boolean
  amountValid: boolean
  unlockDateValid: boolean
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

  const projectName = String(formData?.get('projectName') ?? '').trim()
  const tokenMint = String(formData?.get('tokenMint') ?? '').trim()
  const amount = String(formData?.get('amount') ?? '').trim()
  const unlockDate = String(formData?.get('unlockDate') ?? '').trim()
  const unlockTime = String(formData?.get('unlockTime') ?? '').trim()
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

  if (unlockDate && unlockTime) {
    const unlockAt = combineUnlockDateTime(unlockDate, unlockTime)
    unlockDateValid = !Number.isNaN(new Date(unlockAt).getTime()) && new Date(unlockAt).getTime() > Date.now()
  }

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
    disableReasons.push('Enter a valid amount greater than zero.')
  }

  if (!unlockDateValid) {
    disableReasons.push('Choose a future unlock date and time.')
  }

  if (!safetyChecked) {
    disableReasons.push('Acknowledge the safety notice.')
  }

  const formValid =
    projectNameValid && mintValid && amountValid && unlockDateValid && safetyChecked

  const canPreview = walletConnected && formValid
  const canCreate = canPreview && programDeployed

  return {
    walletConnected,
    programDeployed,
    safetyChecked,
    projectNameValid,
    mintValid,
    amountValid,
    unlockDateValid,
    canPreview,
    canCreate,
    disableReasons,
  }
}
