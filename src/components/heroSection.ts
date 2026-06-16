import bannerUrl from '../assets/banner.png'

import { renderSolanaLogomark } from './solanaLogomark'

export function renderHeroSection(): string {
  return `
    <header class="page-hero" id="hero" aria-labelledby="hero-heading">
      <h1 class="visually-hidden" id="hero-heading">CBS Token Locker</h1>
      <div class="page-hero__banner-wrap">
        <img
          class="page-hero__banner"
          src="${bannerUrl}"
          alt="CBS Token Locker"
          decoding="async"
        />
      </div>
      <p class="page-hero__subtitle">
        Lock SPL tokens on
        <span class="solana-inline">
          ${renderSolanaLogomark()}
          <span>Solana</span>
        </span>
        to show transparency and long-term commitment.
      </p>
      <section class="hero-community-note" aria-label="Pricing and fees">
        <p class="hero-community-note__title">🧡 Built for the Solana Community</p>
        <p class="hero-community-note__line">The CBS Token Locker is free to use.</p>
        <p class="hero-community-note__line">CBS does not charge platform fees.</p>
        <p class="hero-community-note__line">
          You only pay Solana network fees when creating or unlocking locks.
        </p>
      </section>
    </header>
  `
}
