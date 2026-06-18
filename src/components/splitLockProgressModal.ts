import type { LockRecord } from '../types/lock'
import type { SplitLockTrancheResult } from '../types/splitLock'
import { formatAmount, formatDateTime } from '../utils/format'
import { escapeHtml } from '../utils/html'
import { getPublicLockPath } from '../locker'
import { navigate } from '../routes'

export type SplitLockProgressController = {
  setActiveTranche: (index: number, total: number) => void
  updateResults: (results: SplitLockTrancheResult[]) => void
  showSuccess: (locks: LockRecord[]) => void
  showPartialFailure: (input: {
    completedCount: number
    totalCount: number
    failedIndex: number
    message: string
    results: SplitLockTrancheResult[]
  }) => void
  close: () => void
}

function renderTrancheRow(result: SplitLockTrancheResult, amount: string, unlockAt: string): string {
  const statusClass = `split-lock-progress-item--${result.status}`
  let statusText = 'Pending'

  if (result.status === 'active') {
    statusText = 'In progress…'
  } else if (result.status === 'success') {
    statusText = 'Created'
  } else if (result.status === 'failed') {
    statusText = 'Failed'
  } else if (result.status === 'skipped') {
    statusText = 'Skipped'
  }

  const link =
    result.status === 'success' && result.lockAccount
      ? `<a class="lock-link" href="${getPublicLockPath(result.lockAccount)}" data-router-link>View</a>`
      : ''

  return `
    <li class="split-lock-progress-item ${statusClass}" data-split-tranche="${result.index}">
      <div class="split-lock-progress-item__main">
        <span class="split-lock-progress-item__index">#${result.index}</span>
        <span class="split-lock-progress-item__meta">
          ${escapeHtml(formatAmount(amount))} · ${escapeHtml(formatDateTime(unlockAt))}
        </span>
      </div>
      <div class="split-lock-progress-item__status">
        <span>${escapeHtml(statusText)}</span>
        ${link}
      </div>
      ${
        result.error
          ? `<p class="split-lock-progress-item__error">${escapeHtml(result.error)}</p>`
          : ''
      }
    </li>
  `
}

export function renderSplitLockProgressModal(
  totalCount: number,
  trancheMeta: Array<{ amount: string; unlockAt: string }>,
  results: SplitLockTrancheResult[],
): string {
  const rows = results
    .map((result, index) =>
      renderTrancheRow(result, trancheMeta[index]?.amount ?? '', trancheMeta[index]?.unlockAt ?? ''),
    )
    .join('')

  return `
    <div class="modal-overlay" id="splitLockProgressModal" data-split-lock-progress-modal>
      <div
        class="modal-dialog split-lock-progress-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="split-lock-progress-heading"
      >
        <h2 class="modal-title" id="split-lock-progress-heading">
          Creating lock 1 of ${totalCount}
        </h2>
        <p class="modal-lead" id="split-lock-progress-lead">
          Approve each transaction in your wallet when prompted.
        </p>

        <ul class="split-lock-progress-list" id="splitLockProgressList">
          ${rows}
        </ul>

        <p class="unlock-progress-success" id="splitLockProgressSuccess" role="status" hidden></p>
        <p class="form-error" id="splitLockProgressError" role="alert" hidden></p>

        <div class="modal-actions">
          <button type="button" class="primary-btn" id="splitLockProgressCloseBtn" hidden>
            Close
          </button>
        </div>
      </div>
    </div>
  `
}

export function mountSplitLockProgressModal(
  totalCount: number,
  trancheMeta: Array<{ amount: string; unlockAt: string }>,
  results: SplitLockTrancheResult[],
): {
  modalRoot: HTMLElement
  controller: SplitLockProgressController
} {
  const wrapper = document.createElement('div')
  wrapper.innerHTML = renderSplitLockProgressModal(totalCount, trancheMeta, results).trim()
  const modalRoot = wrapper.firstElementChild as HTMLElement

  document.body.appendChild(modalRoot)

  const heading = modalRoot.querySelector<HTMLElement>('#split-lock-progress-heading')
  const list = modalRoot.querySelector<HTMLElement>('#splitLockProgressList')
  const success = modalRoot.querySelector<HTMLElement>('#splitLockProgressSuccess')
  const error = modalRoot.querySelector<HTMLElement>('#splitLockProgressError')
  const closeButton = modalRoot.querySelector<HTMLButtonElement>('#splitLockProgressCloseBtn')

  const close = (): void => {
    modalRoot.remove()
    document.body.classList.remove('modal-open')
  }

  closeButton?.addEventListener('click', close)

  modalRoot.addEventListener('click', (event) => {
    if (event.target === modalRoot && closeButton && !closeButton.hidden) {
      close()
    }
  })

  const rerenderList = (nextResults: SplitLockTrancheResult[]): void => {
    if (!list) {
      return
    }

    list.innerHTML = nextResults
      .map((result, index) =>
        renderTrancheRow(
          result,
          trancheMeta[index]?.amount ?? '',
          trancheMeta[index]?.unlockAt ?? '',
        ),
      )
      .join('')
  }

  const controller: SplitLockProgressController = {
    setActiveTranche(index, total) {
      if (heading) {
        heading.textContent = `Creating lock ${index} of ${total}`
      }
    },
    updateResults(nextResults) {
      rerenderList(nextResults)
    },
    showSuccess(locks) {
      if (heading) {
        heading.textContent = 'All locks created'
      }

      if (success) {
        success.hidden = false
        success.textContent = `${locks.length} locks created successfully.`
      }

      if (closeButton) {
        closeButton.hidden = false
      }
    },
    showPartialFailure({ completedCount, totalCount, failedIndex, message, results: nextResults }) {
      if (heading) {
        heading.textContent = `${completedCount} of ${totalCount} locks created`
      }

      rerenderList(nextResults)

      if (error) {
        error.hidden = false
        error.textContent = `Lock ${failedIndex} failed: ${message}`
      }

      if (closeButton) {
        closeButton.hidden = false
      }
    },
    close,
  }

  document.body.classList.add('modal-open')

  return { modalRoot, controller }
}

export function attachSplitLockProgressLinkHandlers(modalRoot: HTMLElement): void {
  modalRoot.addEventListener('click', (event) => {
    const target = event.target

    if (!(target instanceof HTMLElement)) {
      return
    }

    const link = target.closest<HTMLAnchorElement>('a[data-router-link]')

    if (!link) {
      return
    }

    event.preventDefault()
    navigate(link.getAttribute('href') ?? '/')
  })
}
