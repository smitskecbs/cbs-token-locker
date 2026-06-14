import { renderFeatureCardGrid } from './featureCard'

export function renderHowItWorksSection(options?: { embedded?: boolean }): string {
  const embedded = options?.embedded === true
  const heading = embedded
    ? `<h3 class="technical-details__heading">How It Works</h3>`
    : `<h2 class="section-title" id="how-it-works-heading">How It Works</h2>`

  const content = renderFeatureCardGrid([
    {
      title: 'Lock tokens on-chain',
      body:
        'Submit a wallet transaction to move tokens into a program-controlled vault until the unlock date.',
    },
    {
      title: 'Public verification',
      body:
        'Every lock has a public page showing vault balance, owner wallet, unlock time, and on-chain status.',
    },
    {
      title: 'Owner-only unlock',
      body:
        'After the unlock date, only the original locker wallet can return tokens from the vault.',
    },
    {
      title: 'Transparency, not guarantees',
      body:
        'On-chain locking improves transparency but does not guarantee project legitimacy, liquidity, or future value.',
      variant: 'warning',
    },
  ])

  if (embedded) {
    return `<div class="technical-details__block">${heading}${content}</div>`
  }

  return `
    <section
      class="page-section"
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
    >
      ${heading}
      ${content}
    </section>
  `
}
