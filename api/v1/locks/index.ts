import { assertIsAddress } from '@solana/kit'
import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  classifyApiError,
  getErrorMessage,
  invalidClusterResponse,
  invalidSearchParamsResponse,
} from '../../../src/solana/apiErrors'
import { fetchLocksByOwner, searchOnChainLocks } from '../../../src/solana/client'
import type { SolanaNetwork } from '../../../src/solana/config'
import { logApiRequestCluster } from '../../../src/solana/config'
import { parseRequestCluster } from '../../../src/solana/requestCluster'
import type { LockSearchField } from '../../../src/types/lock'

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

function readSearchField(value: string | null): LockSearchField {
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
  logApiRequestCluster(cluster, '/api/v1/locks')

  const owner = url.searchParams.get('owner')
  const query = url.searchParams.get('q') || ''
  const field = readSearchField(url.searchParams.get('field'))

  if (owner) {
    try {
      assertIsAddress(owner)
    } catch (error) {
      const invalid = invalidSearchParamsResponse(getErrorMessage(error))
      response.status(invalid.status).json(invalid.body)
      return
    }

    try {
      const locks = await fetchLocksByOwner(owner, cluster)
      response.status(200).json({ cluster, locks })
      return
    } catch (error) {
      const apiError = classifyApiError(error)
      response.status(apiError.status).json(apiError.body)
      return
    }
  }

  if (!query) {
    response.status(200).json({ cluster, locks: [] })
    return
  }

  try {
    const locks = await searchOnChainLocks(query, field, cluster)
    response.status(200).json({ cluster, locks })
  } catch (error) {
    const apiError = classifyApiError(error)
    response.status(apiError.status).json(apiError.body)
  }
}
