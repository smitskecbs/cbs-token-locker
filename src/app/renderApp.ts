import { renderDebugPanel } from '../components/debugPanel'
import { renderHeroSection } from '../components/heroSection'
import { attachHowItWorksModalHandlers, renderHowItWorksModal } from '../components/howItWorksModal'
import { renderHowItWorksSection } from '../components/howItWorksSection'
import { renderMainAppCard } from '../components/mainAppCard'
import { renderOverviewSection } from '../components/overviewSection'
import { renderSiteFooter } from '../components/siteFooter'
import { renderSupportBlock } from '../components/supportBlock'
import type { LockSearchField } from '../types/lock'

export function renderHomeApp(
  _publicSearchQuery = '',
  _publicSearchField: LockSearchField = 'all',
): string {
  return `
    <main class="app-shell">
      ${renderHeroSection()}
      ${renderOverviewSection()}
      ${renderHowItWorksSection()}
      ${renderMainAppCard({})}
      ${renderSupportBlock()}
      ${renderDebugPanel()}
      ${renderSiteFooter()}
      ${renderHowItWorksModal()}
    </main>
  `
}

export { attachHowItWorksModalHandlers }
