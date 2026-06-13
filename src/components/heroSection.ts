import { getPublicLocksPath } from '../routes'

export function renderHeroSection(): string {
  return `
    <section class="hero-card" id="hero" aria-labelledby="hero-heading">
      <p class="hero-eyebrow">Official CBS Tool · On-chain Lock</p>
      <h1 class="hero-title" id="hero-heading">CBS Token Locker</h1>
      <p class="hero-text">
        Lock SPL tokens and LP tokens on Solana with deterministic on-chain lock
        accounts designed for public verification.
      </p>
      <p class="hero-subtext">
        DEX recognition planned. This tool improves transparency but does not
        guarantee project safety.
      </p>
      <div class="hero-actions">
        <button
          type="button"
          class="primary-btn"
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
