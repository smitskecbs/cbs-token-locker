import { renderDebugPanel } from '../components/debugPanel'
import { renderMainAppCard } from '../components/mainAppCard'
import { renderSiteFooter } from '../components/siteFooter'
import type { LockSearchField } from '../types/lock'

export function renderHomeApp(
  _publicSearchQuery = '',
  _publicSearchField: LockSearchField = 'all',
): string {
  return `
    <main class="app-shell app-shell--simple">
      ${renderMainAppCard({})}
      ${renderDebugPanel()}
      ${renderSiteFooter()}
    </main>
  `
}
