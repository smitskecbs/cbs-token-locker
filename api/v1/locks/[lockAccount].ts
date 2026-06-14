import { assertIsAddress } from '@solana/kit'
import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  classifyApiError,
  getErrorMessage,
  invalidClusterResponse,
  invalidLockAccountResponse,
} from '../../../src/solana/apiErrors'
import { fetchOnChainLock } from '../../../src/solana/client'
import type { SolanaNetwork } from '../../../src/solana/config'
import { logApiRequestCluster } from '../../../src/solana/config'
import { parseRequestCluster } from '../../../src/solana/requestCluster'

function setCors(response: VercelResponse): void {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function resolveRequestUrl(request: VercelRequest): URL {
  const protocol = String(request.headers['x-forwarded-proto'] ?? 'https')
  const host = request.headers.host ?? 'localhost'

  return new URL(request.url ?? '/', `${protocol}://${host}`)
}

function resolveCluster(
  url: URL,
): { cluster: SolanaNetwork } | { error: ReturnType<typeof invalidClusterResponse> } {
  const rawCluster = url.searchParams.get('cluster')

  if (rawCluster === null || rawCluster.trim() === '') {
    return { cluster: 'devnet' }
  }

  const parsed = parseRequestCluster(rawCluster)

  if (!parsed) {
    return { error: invalidClusterResponse(`Received cluster=${rawCluster}`) }
  }

  return { cluster: parsed }
}

function readLockAccount(request: VercelRequest, url: URL): string | null {
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

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
): Promise<void> {
  setCors(response)

  if (request.method === 'OPTIONS') {
    response.status(204).end()
    return
  }

  if (request.method !== 'GET') {
    response.status(405).json({ error: 'Method not allowed.' })
    return
  }

  const url = resolveRequestUrl(request)
  const clusterResult = resolveCluster(url)

  if ('error' in clusterResult) {
    response.status(clusterResult.error.status).json(clusterResult.error.body)
    return
  }

  const cluster = clusterResult.cluster
  const lockAccount = readLockAccount(request, url)

  if (!lockAccount) {
    const invalid = invalidLockAccountResponse()
    response.status(invalid.status).json(invalid.body)
    return
  }

  logApiRequestCluster(cluster, `/api/v1/locks/${lockAccount}`)

  try {
    assertIsAddress(lockAccount)
  } catch (error) {
    const invalid = invalidLockAccountResponse(getErrorMessage(error))
    response.status(invalid.status).json(invalid.body)
    return
  }

  try {
    const lock = await fetchOnChainLock(lockAccount, cluster)
    response.status(200).json({ cluster, lock })
  } catch (error) {
    const apiError = classifyApiError(error)
    response.status(apiError.status).json(apiError.body)
  }
}
