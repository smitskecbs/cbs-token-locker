import { renderClusterAdvancedDetails } from './clusterPanel'
import { renderDevnetTestSection } from './devnetTestSection'
import { renderHowItWorksSection } from './howItWorksSection'
import { CBS_LOCKER_PROGRAM_ID } from '../solana/programId'
import { escapeHtml } from '../utils/html'

export function renderAdvancedDetailsSection(): string {
  return `
    <section class="advanced-details-section" id="advanced-details">
      <details class="advanced-details">
        <summary class="advanced-details__summary">Advanced details</summary>
        <div class="advanced-details__content">
          <p class="advanced-details__mono mono">${escapeHtml(CBS_LOCKER_PROGRAM_ID)}</p>
          ${renderClusterAdvancedDetails()}
          ${renderHowItWorksSection({ embedded: true })}
          ${renderDevnetTestSection({ embedded: true })}
        </div>
      </details>
    </section>
  `
}

/** @deprecated Use renderAdvancedDetailsSection */
export function renderTechnicalDetailsSection(): string {
  return renderAdvancedDetailsSection()
}
