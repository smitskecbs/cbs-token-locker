import type { UnlockDebugOutput, UnlockStepId, UnlockStepState } from '../solana/unlockFlow'
import { buildUnlockDebugText } from '../solana/unlockFlow'
import {
  createProgressModalController,
  createProgressReporter,
  renderProgressModalShell,
  renderProgressStep,
} from './progressModal'

export const UNLOCK_PROGRESS_STEPS: Array<{ id: UnlockStepId; label: string }> = [
  { id: 'check-lock-status', label: 'Checking lock status' },
  { id: 'check-vault-balance', label: 'Checking vault balance' },
  { id: 'prepare-transaction', label: 'Preparing unlock transaction' },
  { id: 'wallet-approval', label: 'Waiting for wallet approval' },
  { id: 'confirm-transaction', label: 'Confirming transaction' },
  { id: 'verify-transfer', label: 'Verifying token return' },
  { id: 'completed', label: 'Unlock completed' },
]

const MODAL_SELECTORS = {
  heading: '#unlock-progress-heading',
  lead: '#unlockProgressLead',
  success: '#unlockProgressSuccess',
  error: '#unlockProgressError',
  debugBlock: '#unlockProgressDebug',
  debugText: '#unlockProgressDebugText',
  copyButton: '#unlockProgressCopyDebugBtn',
  closeButton: '#unlockProgressCloseBtn',
}

export function renderUnlockProgressModal(): string {
  const steps = UNLOCK_PROGRESS_STEPS.map((step) =>
    renderProgressStep(step.id, step.label, 'pending'),
  ).join('')

  return renderProgressModalShell({
    modalId: 'unlockProgressModal',
    dataAttr: 'data-unlock-progress-modal',
    headingId: 'unlock-progress-heading',
    title: 'Unlocking Tokens',
    leadId: 'unlockProgressLead',
    lead: 'Keep this window open while your unlock transaction is prepared and confirmed.',
    stepsHtml: steps,
    successId: 'unlockProgressSuccess',
    successMessage: 'Tokens unlocked successfully.',
    errorId: 'unlockProgressError',
    debugBlockId: 'unlockProgressDebug',
    debugTextId: 'unlockProgressDebugText',
    copyDebugBtnId: 'unlockProgressCopyDebugBtn',
    closeBtnId: 'unlockProgressCloseBtn',
  })
}

export type UnlockProgressController = {
  setStepState: (step: UnlockStepId, state: UnlockStepState) => void
  showSuccess: () => void
  showFailure: (message: string, debugOutput: UnlockDebugOutput | null) => void
  close: () => void
  getDebugText: () => string
}

export function createUnlockProgressController(modalRoot: HTMLElement): UnlockProgressController {
  const baseController = createProgressModalController<UnlockStepId>(
    modalRoot,
    MODAL_SELECTORS,
    {
      heading: 'Unlock Failed',
      lead: 'The unlock did not complete. Review the error below and try again.',
    },
  )

  return {
    setStepState: baseController.setStepState,
    showSuccess: () => {
      baseController.showSuccess({
        heading: 'Unlock Complete',
        lead: 'Your tokens were returned to your wallet after on-chain verification.',
      })
    },
    showFailure: (message, debugOutput) => {
      const debugText = debugOutput ? buildUnlockDebugText(debugOutput) : null
      baseController.showFailure(message, debugText)
    },
    close: baseController.close,
    getDebugText: baseController.getDebugText,
  }
}

export function createUnlockProgressReporter(
  controller: UnlockProgressController,
): ReturnType<typeof createProgressReporter<UnlockStepId>> {
  return createProgressReporter(controller)
}

export function mountUnlockProgressModal(): {
  modalRoot: HTMLElement
  controller: UnlockProgressController
  reporter: ReturnType<typeof createUnlockProgressReporter>
} {
  const wrapper = document.createElement('div')
  wrapper.innerHTML = renderUnlockProgressModal().trim()
  const modalRoot = wrapper.firstElementChild as HTMLElement

  document.body.appendChild(modalRoot)

  const controller = createUnlockProgressController(modalRoot)
  const reporter = createUnlockProgressReporter(controller)

  return { modalRoot, controller, reporter }
}
