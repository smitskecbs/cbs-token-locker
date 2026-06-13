import { getPublicLockPath } from '../locker'
import type { CreateLockDebugOutput, CreateLockStepId } from '../solana/createLockFlow'
import { buildCreateLockDebugText } from '../solana/createLockFlow'
import { copyTextToClipboard } from '../utils/copyText'
import { navigate } from '../routes'
import {
  createProgressModalController,
  createProgressReporter,
  renderProgressModalShell,
  renderProgressStep,
  type ProgressStepState,
} from './progressModal'

export const CREATE_LOCK_PROGRESS_STEPS: Array<{ id: CreateLockStepId; label: string }> = [
  { id: 'checking-wallet', label: 'Checking wallet' },
  { id: 'preparing-transaction', label: 'Preparing lock transaction' },
  { id: 'waiting-wallet-approval', label: 'Waiting for wallet approval' },
  { id: 'sending-transaction', label: 'Sending transaction' },
  { id: 'confirming-transaction', label: 'Confirming transaction' },
  { id: 'verifying-lock', label: 'Verifying lock account' },
  { id: 'completed', label: 'Lock created successfully' },
]

const MODAL_SELECTORS = {
  heading: '#createLockProgressHeading',
  lead: '#createLockProgressLead',
  success: '#createLockProgressSuccess',
  error: '#createLockProgressError',
  debugBlock: '#createLockProgressDebug',
  debugText: '#createLockProgressDebugText',
  copyButton: '#createLockProgressCopyDebugBtn',
  closeButton: '#createLockProgressCloseBtn',
  successDetails: '#createLockProgressSuccessDetails',
}

export type CreateLockSuccessDetails = {
  lockAccount: string
  vaultAccount: string
  signature: string
}

export type CreateLockProgressController = {
  setStepState: (step: CreateLockStepId, state: ProgressStepState) => void
  showSuccess: (details: CreateLockSuccessDetails) => void
  showFailure: (message: string, debugOutput: CreateLockDebugOutput | null) => void
  close: () => void
  getDebugText: () => string
}

function renderCreateLockSuccessDetails(): string {
  return `
    <dl class="detail-list create-lock-progress-details">
      <div class="detail-item">
        <dt>Lock account</dt>
        <dd class="mono" data-create-lock-result-lock>n/a</dd>
      </div>
      <div class="detail-item">
        <dt>Vault account</dt>
        <dd class="mono" data-create-lock-result-vault>n/a</dd>
      </div>
      <div class="detail-item">
        <dt>Transaction signature</dt>
        <dd class="mono" data-create-lock-result-signature>n/a</dd>
      </div>
    </dl>
  `
}

export function renderCreateLockProgressModal(): string {
  const steps = CREATE_LOCK_PROGRESS_STEPS.map((step) =>
    renderProgressStep(step.id, step.label, 'pending'),
  ).join('')

  return renderProgressModalShell({
    modalId: 'createLockProgressModal',
    dataAttr: 'data-create-lock-progress-modal',
    headingId: 'createLockProgressHeading',
    title: 'Creating On-Chain Lock',
    leadId: 'createLockProgressLead',
    lead: 'Keep this window open while your lock transaction is prepared, signed, and confirmed.',
    stepsHtml: steps,
    successId: 'createLockProgressSuccess',
    successMessage: 'Lock created successfully.',
    successDetailsId: 'createLockProgressSuccessDetails',
    successDetailsHtml: renderCreateLockSuccessDetails(),
    errorId: 'createLockProgressError',
    debugBlockId: 'createLockProgressDebug',
    debugTextId: 'createLockProgressDebugText',
    copyDebugBtnId: 'createLockProgressCopyDebugBtn',
    closeBtnId: 'createLockProgressCloseBtn',
    extraActionsHtml: `
      <button type="button" class="primary-btn" id="createLockProgressViewLockBtn" hidden>
        View Lock
      </button>
      <button type="button" class="secondary-btn" id="createLockProgressCopyLinkBtn" hidden>
        Copy Link
      </button>
    `,
  })
}

export function createCreateLockProgressController(
  modalRoot: HTMLElement,
): CreateLockProgressController {
  const baseController = createProgressModalController<CreateLockStepId>(
    modalRoot,
    MODAL_SELECTORS,
    {
      heading: 'Create Lock Failed',
      lead: 'The lock was not created. Review the error below and try again.',
    },
  )

  const viewLockButton = modalRoot.querySelector<HTMLButtonElement>('#createLockProgressViewLockBtn')
  const copyLinkButton = modalRoot.querySelector<HTMLButtonElement>('#createLockProgressCopyLinkBtn')
  const lockResultElement = modalRoot.querySelector<HTMLElement>('[data-create-lock-result-lock]')
  const vaultResultElement = modalRoot.querySelector<HTMLElement>('[data-create-lock-result-vault]')
  const signatureResultElement = modalRoot.querySelector<HTMLElement>(
    '[data-create-lock-result-signature]',
  )

  let successLockAccount: string | null = null

  const showSuccess = (details: CreateLockSuccessDetails): void => {
    successLockAccount = details.lockAccount

    if (lockResultElement) {
      lockResultElement.textContent = details.lockAccount
    }

    if (vaultResultElement) {
      vaultResultElement.textContent = details.vaultAccount
    }

    if (signatureResultElement) {
      signatureResultElement.textContent = details.signature
    }

    baseController.showSuccess({
      heading: 'Lock Created',
      lead: 'Your on-chain lock is live and verified. Share the lock page or review the account details below.',
    })

    if (viewLockButton) {
      viewLockButton.hidden = false
    }

    if (copyLinkButton) {
      copyLinkButton.hidden = false
    }
  }

  const showFailure = (message: string, debugOutput: CreateLockDebugOutput | null): void => {
    const debugText = debugOutput ? buildCreateLockDebugText(debugOutput) : null
    baseController.showFailure(message, debugText)
  }

  viewLockButton?.addEventListener('click', () => {
    if (!successLockAccount) {
      return
    }

    navigate(getPublicLockPath(successLockAccount))
    baseController.close()
  })

  copyLinkButton?.addEventListener('click', async () => {
    if (!successLockAccount) {
      return
    }

    const url = new URL(getPublicLockPath(successLockAccount), window.location.origin).toString()
    const copied = await copyTextToClipboard(url)
    copyLinkButton.textContent = copied ? 'Link Copied' : 'Copy Failed'

    window.setTimeout(() => {
      copyLinkButton.textContent = 'Copy Link'
    }, 2000)
  })

  return {
    setStepState: baseController.setStepState,
    showSuccess,
    showFailure,
    close: baseController.close,
    getDebugText: baseController.getDebugText,
  }
}

export function mountCreateLockProgressModal(): {
  modalRoot: HTMLElement
  controller: CreateLockProgressController
  reporter: ReturnType<typeof createProgressReporter<CreateLockStepId>>
} {
  const wrapper = document.createElement('div')
  wrapper.innerHTML = renderCreateLockProgressModal().trim()
  const modalRoot = wrapper.firstElementChild as HTMLElement

  document.body.appendChild(modalRoot)

  const controller = createCreateLockProgressController(modalRoot)
  const reporter = createProgressReporter(controller)

  return { modalRoot, controller, reporter }
}
