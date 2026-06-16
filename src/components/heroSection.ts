import bannerUrl from '../assets/banner.png'

import { renderSolanaLogomark } from './solanaLogomark'

export function renderHeroSection(): string {
  return `
    <header class="page-hero" id="hero" aria-labelledby="hero-heading">
      <div class="page-hero__banner-wrap">
        <img
          class="page-hero__banner"
          src="${bannerUrl}"
          alt=""
          decoding="async"
        />
      </div>
      <h1 class="page-hero__title" id="hero-heading">CBS Token Locker</h1>
      <p class="page-hero__subtitle">
        Lock SPL tokens on
        <span class="solana-inline">
          ${renderSolanaLogomark()}
          <span>Solana</span>
        </span>
        to show transparency and long-term commitment.
      </p>
    </header>
  `
}
