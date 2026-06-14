type RpcCallEntry = {
  method: string
  source: string
  timestamp: number
  tab: string
}

const WINDOW_MS = 30_000
const MAX_ENTRIES = 500

let activeTab = 'create'
let currentSource = 'unspecified'
const entries: RpcCallEntry[] = []
const listeners = new Set<() => void>()

function isDevMode(): boolean {
  return import.meta.env.DEV
}

function notifyListeners(): void {
  for (const listener of listeners) {
    listener()
  }
}

function pruneEntries(now: number): void {
  const cutoff = now - WINDOW_MS

  while (entries.length > 0 && entries[0].timestamp < cutoff) {
    entries.shift()
  }

  while (entries.length > MAX_ENTRIES) {
    entries.shift()
  }
}

export function setRpcActiveTab(tab: string): void {
  activeTab = tab
}

export function getRpcActiveTab(): string {
  return activeTab
}

export function setRpcCallSource(source: string): void {
  currentSource = source
}

export function getRpcCallSource(): string {
  return currentSource
}

export async function withRpcCallSource<T>(source: string, fn: () => Promise<T>): Promise<T> {
  const previous = currentSource
  currentSource = source

  try {
    return await fn()
  } finally {
    currentSource = previous
  }
}

export function recordRpcCall(method: string, source = currentSource, tab = activeTab): void {
  if (!isDevMode()) {
    return
  }

  const timestamp = Date.now()
  const entry: RpcCallEntry = {
    method,
    source,
    timestamp,
    tab,
  }

  entries.push(entry)
  pruneEntries(timestamp)

  console.info('[CBS Locker RPC]', {
    method,
    source,
    tab,
    timestamp: new Date(timestamp).toISOString(),
  })

  notifyListeners()
}

export type RpcCallerStat = {
  source: string
  count: number
}

export function getRpcCallStats(): {
  countLast30s: number
  topCallers: RpcCallerStat[]
} {
  const now = Date.now()
  const cutoff = now - WINDOW_MS
  const recent = entries.filter((entry) => entry.timestamp >= cutoff)
  const callerCounts = new Map<string, number>()

  for (const entry of recent) {
    callerCounts.set(entry.source, (callerCounts.get(entry.source) ?? 0) + 1)
  }

  const topCallers = [...callerCounts.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 8)

  return {
    countLast30s: recent.length,
    topCallers,
  }
}

export function subscribeToRpcCallTracker(listener: () => void): () => void {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}
