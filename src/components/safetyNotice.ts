import { escapeHtml } from '../utils/html'

function noticeHeadingId(scope?: string): string {
  return scope ? `safety-notice-heading-${scope}` : 'safety-notice-heading'
}

export function renderSafetyNotice(scope?: string): string {
  const headingId = escapeHtml(noticeHeadingId(scope))

  return `
    <aside
      class="safety-notice"
      data-safety-notice
      aria-labelledby="${headingId}"
    >
      <p class="safety-notice__title" id="${headingId}">
        Safety Notice
      </p>
      <p class="safety-notice__lead">
        CBS Token Locker improves transparency but cannot guarantee:
      </p>
      <ul class="safety-notice__list">
        <li>Project legitimacy</li>
        <li>Token value</li>
        <li>Future liquidity</li>
        <li>Future profitability</li>
        <li>Project success</li>
      </ul>
      <p class="safety-notice__footer">
        Always do your own research before investing.
      </p>
    </aside>
  `
}
