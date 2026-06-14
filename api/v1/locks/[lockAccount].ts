import { assertIsAddress } from '@solana/kit'
import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  classifyApiError,
  getErrorMessage,
  invalidLockAccountResponse,
} from '../../../serverless/apiErrors.js'
import { fetchOnChainLock } from '../../../serverless/fetchLock.js'
import { readLockAccount, resolveCluster, resolveRequestUrl, setCors } from '../../../serverless/http.js'
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
