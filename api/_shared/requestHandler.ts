import { assertIsAddress } from '@solana/kit'

import {
  classifyApiError,
  getErrorMessage,
  invalidClusterResponse,
  invalidLockAccountResponse,
  invalidSearchParamsResponse,
  type ApiErrorBody,
} from './apiErrors.ts'
import {
  fetchLocksByOwner,
  fetchOnChainLock,
  searchOnChainLocks,
} from '../../src/solana/client.ts'
import { logApiRequestCluster } from '../../src/solana/config.ts'
import type { SolanaNetwork } from '../../src/solana/config.ts'
import { CBS_LOCKER_PROGRAM_ID } from '../../src/solana/programId.ts'
import { parseRequestCluster } from '../../src/solana/requestCluster.ts'
import type { LockSearchField } from '../../src/types/lock.ts'

const REPOSITORY_URL =
  process.env.CBS_LOCKER_REPOSITORY_URL ||
  'https://github.com/cbs-coin/cbs-token-locker'

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
} as const

export type ApiResponseSink = {
  writeHead(status: number, headers: Record<string, string>): void
  end(body: string): void
}

function sendJson(sink: ApiResponseSink, status: number, payload: unknown): void {
  sink.writeHead(status, { ...CORS_HEADERS })
  sink.end(JSON.stringify(payload))
}

function sendApiError(
  sink: ApiResponseSink,
  status: number,
  body: ApiErrorBody,
): void {
  sendJson(sink, status, body)
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

function resolveRequestCluster(
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

function assertValidAddress(
  value: string,
  invalidResponse: () => ReturnType<typeof invalidSearchParamsResponse>,
): void {
  try {
    assertIsAddress(value)
  } catch (error) {
    const response = invalidResponse()
    response.body.details = getErrorMessage(error)
    throw response
  }
}

function isApiErrorResponse(error: unknown): error is { status: number; body: ApiErrorBody } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    'body' in error &&
    typeof (error as { status: unknown }).status === 'number'
  )
}

export async function handleApiRequest(
  method: string | undefined,
  url: URL,
  sink: ApiResponseSink,
): Promise<void> {
  if (method === 'OPTIONS') {
    sendJson(sink, 204, {})
    return
  }

  if (method !== 'GET') {
    sendJson(sink, 405, { error: 'Method not allowed.' })
    return
  }

  const clusterResult = resolveRequestCluster(url)

  if ('error' in clusterResult) {
    sendApiError(sink, clusterResult.error.status, clusterResult.error.body)
    return
  }

  const cluster = clusterResult.cluster
  logApiRequestCluster(cluster, url.pathname)

  if (url.pathname === '/api/v1/program') {
    sendJson(sink, 200, {
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
    return
  }

  const lockMatch = url.pathname.match(/^\/api\/v1\/locks\/([^/]+)$/)

  if (lockMatch) {
    let lockAccount: string

    try {
      lockAccount = decodeURIComponent(lockMatch[1])
      assertValidAddress(lockAccount, invalidLockAccountResponse)
    } catch (error) {
      if (isApiErrorResponse(error)) {
        sendApiError(sink, error.status, error.body)
        return
      }

      sendApiError(sink, 400, invalidLockAccountResponse().body)
      return
    }

    try {
      const lock = await fetchOnChainLock(lockAccount, cluster)
      sendJson(sink, 200, { cluster, lock })
      return
    } catch (error) {
      const apiError = classifyApiError(error)
      sendApiError(sink, apiError.status, apiError.body)
      return
    }
  }

  if (url.pathname === '/api/v1/locks') {
    const owner = url.searchParams.get('owner')
    const query = url.searchParams.get('q') || ''
    const field = readSearchField(url.searchParams.get('field'))

    if (owner) {
      try {
        assertValidAddress(owner, invalidSearchParamsResponse)
      } catch (error) {
        if (isApiErrorResponse(error)) {
          sendApiError(sink, error.status, error.body)
          return
        }

        sendApiError(sink, 400, invalidSearchParamsResponse().body)
        return
      }

      try {
        const locks = await fetchLocksByOwner(owner, cluster)
        sendJson(sink, 200, { cluster, locks })
        return
      } catch (error) {
        const apiError = classifyApiError(error)
        sendApiError(sink, apiError.status, apiError.body)
        return
      }
    }

    if (!query) {
      sendJson(sink, 200, { cluster, locks: [] })
      return
    }

    try {
      const locks = await searchOnChainLocks(query, field, cluster)
      sendJson(sink, 200, { cluster, locks })
      return
    } catch (error) {
      const apiError = classifyApiError(error)
      sendApiError(sink, apiError.status, apiError.body)
      return
    }
  }

  sendJson(sink, 404, { error: 'Not found.' })
}

export function createNodeResponseSink(response: {
  writeHead(status: number, headers: Record<string, string>): void
  end(body: string): void
}): ApiResponseSink {
  return {
    writeHead(status, headers) {
      response.writeHead(status, headers)
    },
    end(body) {
      response.end(body)
    },
  }
}
