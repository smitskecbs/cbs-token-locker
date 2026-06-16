import { DONATION_WALLET_ADDRESS } from './siteFooter'
import { escapeHtml } from '../utils/html'
import { formatWalletAddress } from '../utils/format'

export function renderSupportBlock(): string {
  return `
    <section class="support-block" id="support" aria-labelledby="support-heading">
      <h2 class="support-block__title" id="support-heading">Support CBS Ecosystem</h2>
      <p class="support-block__text">
        Optional donations help fund development and infrastructure.
      </p>
      <p class="support-block__wallet mono" title="${escapeHtml(DONATION_WALLET_ADDRESS)}">
        ${escapeHtml(formatWalletAddress(DONATION_WALLET_ADDRESS, 6))}
      </p>
      <button type="button" class="secondary-btn support-block__copy" data-support-copy>
        Copy address
      </button>
    </section>
  `
}
