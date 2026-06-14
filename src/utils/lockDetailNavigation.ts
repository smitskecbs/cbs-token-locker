import type { AppTabId } from '../components/mainAppCard'
import { getCurrentRoute, navigate } from '../routes'

export type LockDetailReturnTarget =
  | { kind: 'create' }
  | { kind: 'tab'; tab: Exclude<AppTabId, 'create'> }
  | { kind: 'public-search'; path: string }

const STORAGE_KEY = 'cbs-locker-lock-return'

export function captureLockDetailReturnTarget(): void {
  const route = getCurrentRoute()

  if (route.name === 'locks') {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        kind: 'public-search',
        path: `${window.location.pathname}${window.location.search}`,
      } satisfies LockDetailReturnTarget),
    )
    return
  }

  if (route.name === 'home') {
    const activeTab = document.querySelector<HTMLElement>('[data-app-tab].is-active')?.dataset
      .appTab

    if (activeTab === 'locks' || activeTab === 'history' || activeTab === 'search') {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ kind: 'tab', tab: activeTab } satisfies LockDetailReturnTarget),
      )
      return
    }
  }

  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ kind: 'create' } satisfies LockDetailReturnTarget),
  )
}

export function peekLockDetailReturnTarget(): LockDetailReturnTarget {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)

    if (raw) {
      const parsed = JSON.parse(raw) as LockDetailReturnTarget

      if (
        parsed.kind === 'create' ||
        (parsed.kind === 'tab' &&
          (parsed.tab === 'locks' || parsed.tab === 'history' || parsed.tab === 'search')) ||
        (parsed.kind === 'public-search' && typeof parsed.path === 'string')
      ) {
        return parsed
      }
    }
  } catch {
    sessionStorage.removeItem(STORAGE_KEY)
  }

  return { kind: 'create' }
}

export function consumeLockDetailReturnTarget(): LockDetailReturnTarget {
  const target = peekLockDetailReturnTarget()
  sessionStorage.removeItem(STORAGE_KEY)
  return target
}

export function getLockDetailBackLabel(target: LockDetailReturnTarget): string {
  if (target.kind === 'tab') {
    if (target.tab === 'locks') {
      return 'Back to My Locks'
    }

    if (target.tab === 'history') {
      return 'Back to History'
    }

    return 'Back to Search'
  }

  if (target.kind === 'public-search') {
    return 'Back to Search'
  }

  return 'Back to Create Lock'
}

export type HomeTabActivator = (tab: AppTabId) => void

let homeTabActivator: HomeTabActivator | null = null

export function registerHomeTabActivator(activator: HomeTabActivator): void {
  homeTabActivator = activator
}

export function closeLockDetailView(): void {
  const target = consumeLockDetailReturnTarget()

  if (target.kind === 'public-search') {
    navigate(target.path)
    return
  }

  navigate('/')

  if (target.kind === 'tab') {
    queueMicrotask(() => {
      homeTabActivator?.(target.tab)
    })
  } else {
    queueMicrotask(() => {
      homeTabActivator?.('create')
    })
  }
}
