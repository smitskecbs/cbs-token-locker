import type { VercelRequest, VercelResponse } from '@vercel/node'

import { invalidClusterResponse } from './apiErrors.js'
import { DEFAULT_CLUSTER, parseRequestCluster, type SolanaNetwork } from './cluster.js'

export function setCors(response: VercelResponse): void {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

export function resolveRequestUrl(request: VercelRequest): URL {
  const protocol = String(request.headers['x-forwarded-proto'] ?? 'https')
  const host = request.headers.host ?? 'localhost'

  return new URL(request.url ?? '/', `${protocol}://${host}`)
}

export function resolveCluster(
  url: URL,
): { cluster: SolanaNetwork } | { error: ReturnType<typeof invalidClusterResponse> } {
  const rawCluster = url.searchParams.get('cluster')

  if (rawCluster === null || rawCluster.trim() === '') {
    return { cluster: DEFAULT_CLUSTER }
  }

  const parsed = parseRequestCluster(rawCluster)

  if (!parsed) {
    return { error: invalidClusterResponse(`Received cluster=${rawCluster}`) }
  }

  return { cluster: parsed }
}

export function readSearchField(
  value: string | null,
): 'all' | 'lockId' | 'wallet' | 'mint' | 'project' {
  if (
    value === 'lockId' ||
    value === 'wallet' ||
    value === 'mint' ||
    value === 'project'
  ) {
    return value
  }

  return 'all'
}

export function readLockAccount(request: VercelRequest, url: URL): string | null {
  const queryValue = request.query.lockAccount

  if (typeof queryValue === 'string' && queryValue.trim()) {
    return decodeURIComponent(queryValue.trim())
  }

  if (Array.isArray(queryValue) && queryValue[0]?.trim()) {
    return decodeURIComponent(queryValue[0].trim())
  }

  const match = url.pathname.match(/^\/api\/v1\/locks\/([^/]+)$/)

  if (!match) {
    return null
  }

  return decodeURIComponent(match[1])
}
