import { renderClusterPanel } from '../components/clusterPanel'
import { renderCreateLockForm } from '../components/createLockForm'
import { renderDebugPanel } from '../components/debugPanel'
import { renderDevnetTestSection } from '../components/devnetTestSection'
import { renderHeroSection } from '../components/heroSection'
import { renderHowItWorksSection } from '../components/howItWorksSection'
import { renderMyLocksSection } from '../components/myLocksSection'
import { renderPublicLockSearch } from '../components/publicLockSearch'
import { renderSafetyNotice } from '../components/safetyNotice'
import { renderSiteFooter } from '../components/siteFooter'
import { renderWalletPanel } from '../components/walletPanel'
import type { LockSearchField } from '../types/lock'

export function renderHomeApp(
  publicSearchQuery = '',
  publicSearchField: LockSearchField = 'all',
): string {
  return `
    <main class="app-shell">
      ${renderHeroSection()}
      ${renderHowItWorksSection()}
      ${renderClusterPanel()}
      ${renderWalletPanel()}
      ${renderDevnetTestSection()}
      ${renderCreateLockForm()}
      ${renderMyLocksSection([], 'all', false, false)}
      ${renderPublicLockSearch([], publicSearchQuery, publicSearchField, false)}
      ${renderSafetyNotice('home')}
      ${renderDebugPanel()}
      ${renderSiteFooter()}
    </main>
  `
}
