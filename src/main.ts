import './polyfills'
import './styles/style.css'

import { initializeAppState } from './app/initApp'
import { initRouter } from './routes'
import { renderRoute } from './routes/renderRoute'

void initializeAppState().finally(() => {
  initRouter(renderRoute)
})
