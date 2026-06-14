import type { VercelRequest, VercelResponse } from '@vercel/node'

import { invalidClusterResponse } from '../../src/solana/apiErrors'
import type { SolanaNetwork } from '../../src/solana/config'
import { logApiRequestCluster } from '../../src/solana/config'
import { CBS_LOCKER_PROGRAM_ID } from '../../src/solana/programId'
import { parseRequestCluster } from '../../src/solana/requestCluster'

const REPOSITORY_URL =
  process.env.CBS_LOCKER_REPOSITORY_URL ||
  'https://github.com/cbs-coin/cbs-token-locker'

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
