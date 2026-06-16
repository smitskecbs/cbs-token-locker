import { copyTextToClipboard } from '../utils/copyText'
import { showSuccessToast } from '../utils/toast'

export const DONATION_WALLET_ADDRESS = 'ManGofryUWC5VWk7t4ATP32qJtGVBBNoVi2AQ9HyR9J'

let siteFooterHandlersAttached = false

export function renderSiteFooter(): string {
  return `
    <footer class="site-footer">
      <nav class="site-footer__links" aria-label="CBS ecosystem links">
        <a
          class="site-footer__link"
          href="https://tools.cbs-coin.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          CBS Tools
        </a>
        <a
          class="site-footer__link"
          href="https://cbs-coin.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          CBS Coin
        </a>
        <a
          class="site-footer__link"
          href="https://github.com/smitskecbs"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
      </nav>

      <div class="site-footer__open">
        <p class="site-footer__open-title">Built in the Open</p>
        <p class="site-footer__open-text">
          CBS Tools is developed publicly and transparently.
          Source code, improvements and community contributions can be followed on GitHub.
        </p>
      </div>

      <p class="site-footer__badges">Open Source • Community Driven • Built on Solana</p>
      <p class="site-footer__tagline">Community-built tools for Solana builders.</p>
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

    const button = target.closest<HTMLButtonElement>('[data-donation-copy], [data-support-copy]')

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
