import { CBS_LOCKER_PROGRAM_ID } from '../solana/programId'
import { escapeHtml } from '../utils/html'

let howItWorksModalHandlersAttached = false

export function renderHowItWorksModal(): string {
  return `
    <div class="modal-overlay" id="howItWorksModal" data-how-it-works-modal hidden>
      <div
        class="modal-dialog how-it-works-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="how-it-works-modal-heading"
        aria-describedby="how-it-works-modal-subtitle"
      >
        <button
          type="button"
          class="modal-close-btn"
          data-how-it-works-close
          aria-label="Close"
        >
          ×
        </button>

        <header class="how-it-works-dialog__header">
          <h2 class="modal-title" id="how-it-works-modal-heading">CBS Token Locker</h2>
          <p class="modal-lead how-it-works-dialog__subtitle" id="how-it-works-modal-subtitle">
            Lock SPL tokens or LP tokens on Solana and share public proof of your lock.
          </p>
        </header>

        <div class="how-it-works-dialog__body">
          <section class="how-it-works-section">
            <h3 class="how-it-works-section__title">Token Locks</h3>
            <p class="how-it-works-section__body">
              Lock normal SPL tokens until a future date and time.
            </p>
          </section>

          <section class="how-it-works-section">
            <h3 class="how-it-works-section__title">LP Locks</h3>
            <p class="how-it-works-section__body">
              Lock liquidity provider (LP) tokens to demonstrate commitment and transparency.
            </p>
          </section>

          <section class="how-it-works-section">
            <h3 class="how-it-works-section__title">Split Locks</h3>
            <p class="how-it-works-section__body">
              Create multiple independent locks from a single amount.
            </p>
            <p class="how-it-works-section__example">
              Example:<br />
              20% after 1 year<br />
              20% after 2 years<br />
              20% after 3 years<br />
              etc.
            </p>
          </section>

          <section class="how-it-works-section">
            <h3 class="how-it-works-section__title">Public Certificates</h3>
            <p class="how-it-works-section__body">
              Every lock receives a public certificate page that can be shared with your
              community, investors or users.
            </p>
          </section>

          <section class="how-it-works-section">
            <h3 class="how-it-works-section__title">Supported Wallets</h3>
            <ul class="how-it-works-wallet-list">
              <li>Phantom</li>
              <li>Solflare</li>
              <li>Backpack</li>
            </ul>
          </section>

          <section class="how-it-works-section">
            <h3 class="how-it-works-section__title">Mainnet Live</h3>
            <p class="how-it-works-section__body">
              The CBS Token Locker program is deployed on Solana Mainnet.
            </p>
            <p class="how-it-works-section__label">Program ID</p>
            <p class="how-it-works-program-id mono">${escapeHtml(CBS_LOCKER_PROGRAM_ID)}</p>
          </section>

          <section class="how-it-works-section how-it-works-section--process">
            <h3 class="how-it-works-section__title">How It Works</h3>
            <ol class="how-it-works-process-steps">
              <li>Connect wallet</li>
              <li>Select SPL or LP token</li>
              <li>Enter mint address</li>
              <li>Choose lock amount</li>
              <li>Set unlock schedule</li>
              <li>Approve transaction</li>
              <li>Share public proof</li>
            </ol>
          </section>

          <p class="how-it-works-warning">
            Locks improve transparency and demonstrate commitment, but they do not guarantee
            project quality, token value or future performance.
          </p>
        </div>

        <div class="modal-actions how-it-works-dialog__actions">
          <button type="button" class="primary-btn" data-how-it-works-close>
            Close
          </button>
        </div>
      </div>
    </div>
  `
}

function openHowItWorksModal(): void {
  const modal = document.querySelector<HTMLElement>('[data-how-it-works-modal]')

  if (!modal) {
    return
  }

  modal.hidden = false
  document.body.classList.add('modal-open')
}

function closeHowItWorksModal(): void {
  const modal = document.querySelector<HTMLElement>('[data-how-it-works-modal]')

  if (!modal) {
    return
  }

  modal.hidden = true
  document.body.classList.remove('modal-open')
}

export function attachHowItWorksModalHandlers(): void {
  if (howItWorksModalHandlersAttached) {
    return
  }

  howItWorksModalHandlersAttached = true

  document.addEventListener('click', (event) => {
    const target = event.target

    if (!(target instanceof HTMLElement)) {
      return
    }

    if (target.closest('[data-how-it-works-open]')) {
      openHowItWorksModal()
      return
    }

    if (target.closest('[data-how-it-works-close]')) {
      closeHowItWorksModal()
      return
    }

    const modal = document.querySelector<HTMLElement>('[data-how-it-works-modal]')

    if (modal && !modal.hidden && target === modal) {
      closeHowItWorksModal()
    }
  })

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return
    }

    const modal = document.querySelector<HTMLElement>('[data-how-it-works-modal]')

    if (modal && !modal.hidden) {
      closeHowItWorksModal()
    }
  })
}
