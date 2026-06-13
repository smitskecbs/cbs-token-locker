import { renderFeatureCardGrid } from './featureCard'

export function renderHowItWorksSection(): string {
  return `
    <section
      class="page-section"
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
    >
      <h2 class="section-title" id="how-it-works-heading">How It Works</h2>
      ${renderFeatureCardGrid([
        {
          title: 'Preview Mode',
          body:
            'Review lock details locally before submitting. Preview mode is not proof and is never stored as a lock record.',
        },
        {
          title: 'Real On-chain Lock',
          body:
            'Submit a wallet transaction to the CBS Token Locker program. Tokens move into a program-controlled vault until unlock time.',
        },
        {
          title: 'Designed for Public Verification',
          body:
            'Lock accounts, vaults, unlock timestamps, and owner wallets are readable on-chain and through the public lock API.',
        },
        {
          title: 'Important Warning',
          body:
            'On-chain locking improves transparency but does not guarantee project legitimacy, future value, liquidity, or success.',
          variant: 'warning',
        },
      ])}
    </section>
  `
}
