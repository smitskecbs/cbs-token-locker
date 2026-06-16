import { attachAppHandlers, loadPublicLocksPage, stopAppLiveRefresh } from '../app/attachApp'
import { initializeAppState } from '../app/initApp'
import { renderHomeApp } from '../app/renderApp'
import {
  attachLockDetailHandlers,
  loadLockDetailContext,
  renderLockDetailLoading,
  renderLockDetailPage,
  stopLockDetailLiveRefresh,
} from '../components/lockDetailPage'
import { renderPublicLockSearch } from '../components/publicLockSearch'
import { renderSiteFooter } from '../components/siteFooter'
import { renderSupportBlock } from '../components/supportBlock'
import type { AppRoute } from './index'

export function renderRoute(route: AppRoute): void {
  const app = document.querySelector<HTMLDivElement>('#app')

  if (!app) {
    return
  }

  if (route.name === 'lock') {
    stopAppLiveRefresh()
    document.title = `On-chain Lock — CBS Token Locker`
    app.innerHTML = renderLockDetailLoading(route.lockId)

    void loadLockDetailContext(route.lockId).then((context) => {
      app.innerHTML = renderLockDetailPage(context, route.lockId)
      attachLockDetailHandlers(context, route.lockId)
      window.scrollTo(0, 0)
    })

    return
  }

  if (route.name === 'locks') {
    stopLockDetailLiveRefresh()
    document.title = 'Search Locks — CBS Token Locker'
    app.innerHTML = `
      <main class="app-shell">
        ${renderPublicLockSearch([], route.search ?? '', route.field ?? 'all', Boolean(route.search))}
        ${renderSupportBlock()}
        ${renderSiteFooter()}
      </main>
    `
    attachAppHandlers()
    void loadPublicLocksPage(route.search ?? '', route.field ?? 'all')
    window.scrollTo(0, 0)
    return
  }

  stopLockDetailLiveRefresh()
  document.title = 'CBS Token Locker'

  void initializeAppState().then(() => {
    app.innerHTML = renderHomeApp()
    attachAppHandlers()
    window.scrollTo(0, 0)
  })
}
