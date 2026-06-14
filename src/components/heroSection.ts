import { getPublicLocksPath } from '../routes'

export function renderHeroSection(): string {
  return `
    <section class="hero-card" id="hero" aria-labelledby="hero-heading">
      <p class="hero-eyebrow">Official CBS Tool</p>
      <h1 class="hero-title" id="hero-heading">CBS Token Locker</h1>
      <p class="hero-text">
        Lock SPL &amp; LP tokens with public on-chain verification.
      </p>

      <ul class="hero-trust-points" aria-label="Trust highlights">
        <li class="hero-trust-point">
          <span class="hero-trust-point__icon" aria-hidden="true">🔒</span>
          <span>On-chain vaults</span>
        </li>
        <li class="hero-trust-point">
          <span class="hero-trust-point__icon" aria-hidden="true">🌐</span>
          <span>Public lock pages</span>
        </li>
        <li class="hero-trust-point">
          <span class="hero-trust-point__icon" aria-hidden="true">✓</span>
          <span>Owner-only unlocks</span>
        </li>
      </ul>

      <div class="hero-actions">
        <button
          type="button"
          class="primary-btn"
          data-scroll-target="#create-lock"
        >
          Create Lock
        </button>
        <button
          type="button"
          class="secondary-btn"
          data-scroll-target="#wallet"
        >
          Connect Wallet
        </button>
        <a
          class="secondary-btn"
          href="${getPublicLocksPath()}"
          data-router-link
        >
          View Public Locks
        </a>
      </div>
    </section>
  `
}
