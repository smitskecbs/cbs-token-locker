import { escapeHtml } from '../utils/html'

export type FeatureCard = {
  title: string
  body: string
  variant?: 'default' | 'warning'
}

export function renderFeatureCard(card: FeatureCard): string {
  const variantClass =
    card.variant === 'warning' ? ' feature-card--warning' : ''

  return `
    <article class="feature-card${variantClass}">
      <h3 class="feature-card__title">${escapeHtml(card.title)}</h3>
      <p class="feature-card__body">${escapeHtml(card.body)}</p>
    </article>
  `
}

export function renderFeatureCardGrid(cards: FeatureCard[]): string {
  return `
    <div class="feature-card-grid">
      ${cards.map(renderFeatureCard).join('')}
    </div>
  `
}
