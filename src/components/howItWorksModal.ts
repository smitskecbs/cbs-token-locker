let howItWorksModalHandlersAttached = false

export function renderHowItWorksModal(): string {
  return `
    <div class="modal-overlay" id="howItWorksModal" data-how-it-works-modal hidden>
      <div
        class="modal-dialog how-it-works-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="how-it-works-modal-heading"
      >
        <button
          type="button"
          class="modal-close-btn"
          data-how-it-works-close
          aria-label="Close"
        >
          ×
        </button>
        <h2 class="modal-title" id="how-it-works-modal-heading">CBS Token Locker Process</h2>
        <ol class="how-it-works-steps">
          <li>
            <strong>Connect Wallet</strong>
            <span>Connect the wallet that owns the tokens.</span>
          </li>
          <li>
            <strong>Select Token Type</strong>
            <span>Choose whether you want to lock a normal SPL token or an LP token.</span>
          </li>
          <li>
            <strong>Enter Mint</strong>
            <span>Paste the SPL token mint or LP token mint address.</span>
          </li>
          <li>
            <strong>Set Amount</strong>
            <span>Choose how many tokens to lock.</span>
          </li>
          <li>
            <strong>Set Unlock Date</strong>
            <span>Pick the date and time when tokens become unlockable.</span>
          </li>
          <li>
            <strong>Create Lock</strong>
            <span>Approve the transaction and deposit tokens into the lock vault.</span>
          </li>
          <li>
            <strong>Share Proof</strong>
            <span>Use the public lock details to show transparency.</span>
          </li>
          <li>
            <strong>Unlock Later</strong>
            <span>After the unlock date, the owner can unlock the tokens.</span>
          </li>
        </ol>
        <p class="how-it-works-modal__note">
          The locker is designed to improve transparency. It does not remove normal token or market risks.
        </p>
        <div class="modal-actions">
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
