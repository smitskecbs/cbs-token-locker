import './polyfills'
import './styles/style.css'

import faviconUrl from './assets/logo.png'
import { initializeAppState } from './app/initApp'
import { initRouter } from './routes'
import { renderRoute } from './routes/renderRoute'

function setFavicon(url: string): void {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')

  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }

  link.type = 'image/png'
  link.href = url
}

setFavicon(faviconUrl)

void initializeAppState().finally(() => {
  initRouter(renderRoute)
})
