import type { VercelRequest, VercelResponse } from '@vercel/node'

import { CBS_LOCKER_PROGRAM_ID } from '../constants.js'
import { logApiRequestCluster } from '../rpcConfig.js'
import { resolveCluster, resolveRequestUrl, setCors } from '../http.js'

const REPOSITORY_URL =
  process.env.CBS_LOCKER_REPOSITORY_URL ||
  'https://github.com/cbs-coin/cbs-token-locker'

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

  const clusterResult = resolveCluster(resolveRequestUrl(request))

  if ('error' in clusterResult) {
    response.status(clusterResult.error.status).json(clusterResult.error.body)
    return
  }

  const cluster = clusterResult.cluster
  logApiRequestCluster(cluster, '/api/v1/program')

  response.status(200).json({
    cluster,
    programId: CBS_LOCKER_PROGRAM_ID,
    repository: REPOSITORY_URL,
    verification: 'Designed for public verification',
    dexRecognition: 'DEX recognition planned',
    features: [
      'Deterministic lock accounts',
      'Token vault accounts',
      'On-chain unlock timestamp',
      'Owner-only unlock after unlock time',
      'SPL and LP token account support',
      'Token-2022 support prepared',
    ],
  })
}
