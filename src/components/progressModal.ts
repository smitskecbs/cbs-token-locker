import { isDevelopmentMode } from '../state/debugStore'
import { copyTextToClipboard } from '../utils/copyText'
import { escapeHtml } from '../utils/html'

export type ProgressStepState = 'pending' | 'active' | 'success' | 'error'

export function renderProgressStep(
  stepId: string,
  label: string,
  state: ProgressStepState,
): string {
  return `
    <li
      class="unlock-step unlock-step--${state}"
      data-progress-step="${stepId}"
      data-progress-step-state="${state}"
    >
      <span class="unlock-step__icon" aria-hidden="true"></span>
      <span class="unlock-step__label">${escapeHtml(label)}</span>
    </li>
  `
}

export type ProgressReporter<TStep extends string> = {
  startStep: (step: TStep) => void
  completeStep: (step: TStep) => void
  failStep: (step: TStep, message: string) => void
}

export type ProgressModalShellConfig = {
  modalId: string
  dataAttr: string
  dialogClass?: string
  headingId: string
  title: string
  leadId: string
  lead: string
  stepsHtml: string
  successId: string
  successMessage: string
  successDetailsId?: string
  successDetailsHtml?: string
  errorId: string
  debugBlockId: string
  debugTextId: string
  copyDebugBtnId: string
  closeBtnId: string
  extraActionsHtml?: string
}

export function renderProgressModalShell(config: ProgressModalShellConfig): string {
  const dialogClass = config.dialogClass ?? 'unlock-progress-dialog'

  return `
    <div class="modal-overlay" id="${config.modalId}" ${config.dataAttr}>
      <div
        class="modal-dialog ${dialogClass}"
        role="dialog"
        aria-modal="true"
        aria-labelledby="${config.headingId}"
      >
        <h2 class="modal-title" id="${config.headingId}">${escapeHtml(config.title)}</h2>
        <p class="modal-lead" id="${config.leadId}">
          ${escapeHtml(config.lead)}
        </p>

        <ol class="unlock-progress-steps" data-progress-steps>
          ${config.stepsHtml}
        </ol>

        <p class="unlock-progress-success" id="${config.successId}" role="status" hidden>
          ${escapeHtml(config.successMessage)}
        </p>

        ${
          config.successDetailsId
            ? `<div id="${config.successDetailsId}" hidden>${config.successDetailsHtml ?? ''}</div>`
            : ''
        }

        <p class="form-error" id="${config.errorId}" role="alert" hidden></p>

        <div class="unlock-progress-debug" id="${config.debugBlockId}" hidden>
          <p class="simulation-debug__label">Debug output</p>
          <pre class="mono simulation-debug__pre" id="${config.debugTextId}"></pre>
        </div>

        <div class="modal-actions">
          ${config.extraActionsHtml ?? ''}
          <button type="button" class="secondary-btn" id="${config.copyDebugBtnId}" hidden>
            Copy Debug Output
          </button>
          <button type="button" class="secondary-btn" id="${config.closeBtnId}" hidden>
            Close
          </button>
        </div>
      </div>
    </div>
  `
}

export type ProgressModalSelectors = {
  heading: string
  lead: string
  success: string
  error: string
  debugBlock: string
  debugText: string
  copyButton: string
  closeButton: string
  successDetails?: string
}

export type ProgressModalController<TStep extends string> = {
  setStepState: (step: TStep, state: ProgressStepState) => void
  showFailure: (message: string, debugText: string | null) => void
  close: () => void
  getDebugText: () => string
}

export type ProgressFailureContent = {
  heading: string
  lead: string
}

export function createProgressModalController<TStep extends string>(
  modalRoot: HTMLElement,
  selectors: ProgressModalSelectors,
  failureContent: ProgressFailureContent,
): ProgressModalController<TStep> & {
  showSuccess: (content?: { heading?: string; lead?: string }) => void
} {
  const heading = modalRoot.querySelector<HTMLElement>(selectors.heading)
  const lead = modalRoot.querySelector<HTMLElement>(selectors.lead)
  const successElement = modalRoot.querySelector<HTMLElement>(selectors.success)
  const errorElement = modalRoot.querySelector<HTMLElement>(selectors.error)
  const debugBlock = modalRoot.querySelector<HTMLElement>(selectors.debugBlock)
  const debugText = modalRoot.querySelector<HTMLElement>(selectors.debugText)
  const copyButton = modalRoot.querySelector<HTMLButtonElement>(selectors.copyButton)
  const closeButton = modalRoot.querySelector<HTMLButtonElement>(selectors.closeButton)
  const successDetails = selectors.successDetails
    ? modalRoot.querySelector<HTMLElement>(selectors.successDetails)
    : null

  let debugTextValue = ''

  const setStepState = (step: TStep, state: ProgressStepState): void => {
    const stepElement = modalRoot.querySelector<HTMLElement>(`[data-progress-step="${step}"]`)

    if (!stepElement) {
      return
    }

    stepElement.dataset.progressStepState = state
    stepElement.className = `unlock-step unlock-step--${state}`
  }

  const showSuccess = (content?: { heading?: string; lead?: string }): void => {
    if (heading) {
      heading.textContent = content?.heading ?? 'Complete'
    }

    if (lead) {
      lead.textContent = content?.lead ?? 'The operation completed successfully.'
    }

    if (successElement) {
      successElement.hidden = false
    }

    if (successDetails) {
      successDetails.hidden = false
    }

    if (errorElement) {
      errorElement.hidden = true
      errorElement.textContent = ''
    }

    if (closeButton) {
      closeButton.hidden = false
    }
  }

  const showFailure = (message: string, debugOutputText: string | null): void => {
    if (heading) {
      heading.textContent = failureContent.heading
    }

    if (lead) {
      lead.textContent = failureContent.lead
    }

    if (errorElement) {
      errorElement.textContent = message
      errorElement.hidden = false
    }

    if (successElement) {
      successElement.hidden = true
    }

    if (successDetails) {
      successDetails.hidden = true
    }

    if (debugOutputText) {
      debugTextValue = debugOutputText

      if (debugText) {
        debugText.textContent = debugTextValue
      }

      if (debugBlock) {
        debugBlock.hidden = false
      }

      if (copyButton) {
        copyButton.hidden = false
      }
    } else if (isDevelopmentMode()) {
      debugTextValue = message

      if (debugText) {
        debugText.textContent = message
      }

      if (debugBlock) {
        debugBlock.hidden = false
      }

      if (copyButton) {
        copyButton.hidden = false
      }
    }

    if (closeButton) {
      closeButton.hidden = false
    }
  }

  const close = (): void => {
    modalRoot.remove()
  }

  copyButton?.addEventListener('click', async () => {
    if (!debugTextValue) {
      return
    }

    const copied = await copyTextToClipboard(debugTextValue)
    copyButton.textContent = copied ? 'Copied' : 'Copy Failed'

    window.setTimeout(() => {
      copyButton.textContent = 'Copy Debug Output'
    }, 2000)
  })

  closeButton?.addEventListener('click', () => {
    close()
  })

  return {
    setStepState,
    showSuccess,
    showFailure,
    close,
    getDebugText: () => debugTextValue,
  }
}

export function createProgressReporter<TStep extends string>(
  controller: Pick<ProgressModalController<TStep>, 'setStepState'>,
): ProgressReporter<TStep> {
  return {
    startStep: (step) => {
      controller.setStepState(step, 'active')
    },
    completeStep: (step) => {
      controller.setStepState(step, 'success')
    },
    failStep: (step) => {
      controller.setStepState(step, 'error')
    },
  }
}

export function mountProgressModal<TStep extends string>(input: {
  html: string
  selectors: ProgressModalSelectors
  failureContent: ProgressFailureContent
}): {
  modalRoot: HTMLElement
  controller: ProgressModalController<TStep> & {
    showSuccess: (content?: { heading?: string; lead?: string }) => void
  }
  reporter: ProgressReporter<TStep>
} {
  const wrapper = document.createElement('div')
  wrapper.innerHTML = input.html.trim()
  const modalRoot = wrapper.firstElementChild as HTMLElement

  document.body.appendChild(modalRoot)

  const controller = createProgressModalController<TStep>(
    modalRoot,
    input.selectors,
    input.failureContent,
  )
  const reporter = createProgressReporter(controller)

  return { modalRoot, controller, reporter }
}
