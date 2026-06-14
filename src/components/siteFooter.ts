import { copyTextToClipboard } from '../utils/copyText'
import { showSuccessToast } from '../utils/toast'

export const DONATION_WALLET_ADDRESS = 'ManGofryUWC5VWk7t4ATP32qJtGVBBNoVi2AQ9HyR9J'

let siteFooterHandlersAttached = false

export function renderSiteFooter(): string {
  return `
    <footer class="site-footer">
      <p class="site-footer__text">
        Part of the
        <a
          class="site-footer__link"
          href="https://tools.cbs-coin.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          CBS Tools
        </a>
        ecosystem
      </p>
      <button type="button" class="site-footer__donate secondary-btn" data-donation-copy>
        ☕ Support Development
      </button>
    </footer>
  `
}

export function attachSiteFooterHandlers(): void {
  if (siteFooterHandlersAttached) {
    return
  }

  siteFooterHandlersAttached = true

  document.addEventListener('click', (event) => {
    const target = event.target

    if (!(target instanceof HTMLElement)) {
      return
    }

    const button = target.closest<HTMLButtonElement>('[data-donation-copy]')

    if (!button) {
      return
    }

    void copyTextToClipboard(DONATION_WALLET_ADDRESS).then((copied) => {
      if (copied) {
        showSuccessToast('Donation address copied.')
      }
    })
  })
}
