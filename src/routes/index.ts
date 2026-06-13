import type { LockSearchField } from '../types/lock'

export type AppRoute =
  | { name: 'home' }
  | { name: 'lock'; lockId: string }
  | { name: 'locks'; search?: string; field?: LockSearchField }

export function getLockDetailPath(lockId: string): string {
  return `/lock/${encodeURIComponent(lockId)}`
}

export function getPublicLocksPath(
  search = '',
  field: LockSearchField = 'all',
): string {
  const params = new URLSearchParams()

  if (search.trim()) {
    params.set('q', search.trim())
  }

  if (field !== 'all') {
    params.set('field', field)
  }

  const query = params.toString()

  return query ? `/locks?${query}` : '/locks'
}

export function parseRoute(pathname: string, search = ''): AppRoute {
  const lockMatch = pathname.match(/^\/lock\/([^/]+)\/?$/)

  if (lockMatch) {
    return {
      name: 'lock',
      lockId: decodeURIComponent(lockMatch[1]),
    }
  }

  if (pathname === '/locks' || pathname === '/locks/') {
    const params = new URLSearchParams(search)
    const field = params.get('field')

    return {
      name: 'locks',
      search: params.get('q') ?? undefined,
      field:
        field === 'lockId' ||
        field === 'wallet' ||
        field === 'mint' ||
        field === 'project'
          ? field
          : 'all',
    }
  }

  return { name: 'home' }
}

export function getCurrentRoute(): AppRoute {
  return parseRoute(window.location.pathname, window.location.search)
}

type RouteListener = (route: AppRoute) => void

let routeListener: RouteListener | null = null

export function navigate(path: string): void {
  const url = new URL(path, window.location.origin)

  if (
    url.origin === window.location.origin &&
    url.pathname + url.search + url.hash !==
      window.location.pathname + window.location.search + window.location.hash
  ) {
    window.history.pushState(null, '', url.pathname + url.search + url.hash)
    routeListener?.(parseRoute(url.pathname, url.search))
  }
}

export function initRouter(onRouteChange: RouteListener): void {
  routeListener = onRouteChange

  window.addEventListener('popstate', () => {
    routeListener?.(getCurrentRoute())
  })

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement
    const link = target.closest<HTMLAnchorElement>('a[href]')

    if (!link) {
      return
    }

    if (link.origin !== window.location.origin) {
      return
    }

    if (!link.hasAttribute('data-router-link')) {
      return
    }

    event.preventDefault()
    navigate(link.pathname + link.search + link.hash)
  })

  onRouteChange(getCurrentRoute())
}
