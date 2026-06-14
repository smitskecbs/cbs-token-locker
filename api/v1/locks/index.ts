import { assertIsAddress } from '@solana/kit'
import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  classifyApiError,
  getErrorMessage,
  invalidSearchParamsResponse,
} from '../../../serverless/apiErrors.js'
import { readSearchField, resolveCluster, resolveRequestUrl, setCors } from '../../../serverless/http.js'
import { fetchLocksByOwner, searchOnChainLocks } from '../../../serverless/lockService.js'
import { logApiRequestCluster } from '../../../serverless/rpcConfig.js'

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
