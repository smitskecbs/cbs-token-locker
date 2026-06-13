import { escapeHtml } from '../utils/html'

export function renderVerificationBadge(verified: boolean, reason = ''): string {
  if (!verified) {
    return `
      <div class="verification-badge verification-badge--pending" data-verification-badge>
        <span class="verification-badge__icon" aria-hidden="true">!</span>
        <span class="verification-badge__text">
          On-chain verification required
        </span>
      </div>
    `
  }

  return `
    <div class="verification-badge verification-badge--verified" data-verification-badge>
      <span class="verification-badge__icon" aria-hidden="true">✓</span>
      <span class="verification-badge__text">
        ${escapeHtml(reason || 'CBS verified on-chain')}
      </span>
    </div>
  `
}

export function renderDexRecognitionNotice(): string {
  return `
    <p class="dex-recognition-note">
      Designed for public verification. DEX recognition planned for ecosystem
      submission after governed mainnet deployment.
    </p>
  `
}
