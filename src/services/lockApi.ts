import { getRpcActiveTab, getRpcCallSource, recordRpcCall } from '../state/rpcCallTracker'
import type { LockRecord, LockSearchField } from '../types/lock'
import { LockApiError, type LockApiErrorCode } from './lockApiError'

const API_BASE = import.meta.env.VITE_LOCK_API_BASE?.trim() || '/api/v1'

type ApiErrorPayload = {
  error?: string
  code?: string
  details?: string
}

function resolveApiErrorCode(code: string | undefined, status: number): LockApiErrorCode {
  if (
    code === 'RPC_RATE_LIMIT' ||
    code === 'RPC_ERROR' ||
    code === 'INVALID_SEARCH_PARAMS' ||
    code === 'INVALID_LOCK_ACCOUNT'
  ) {
    return code
  }

  if (status === 429) {
    return 'RPC_RATE_LIMIT'
  }

  if (status === 502 || status === 503) {
    return 'RPC_ERROR'
  }

  return 'UNKNOWN'
}

function logApiRequest(
  method: string,
  url: string,
  status: number,
  body?: ApiErrorPayload,
): void {
  if (!import.meta.env.DEV) {
    return
  }

  if (body) {
    console.error('[CBS Locker API Request]', {
      method,
      url,
      status,
      body,
    })
    return
  }

  console.info('[CBS Locker API Request]', {
    method,
    url,
    status,
  })
}

async function readApiErrorPayload(response: Response): Promise<ApiErrorPayload> {
  try {
    return (await response.json()) as ApiErrorPayload
  } catch {
    return {}
  }
}

async function fetchJson<T>(path: string, method = 'GET'): Promise<T> {
  const url = `${API_BASE}${path}`
  recordRpcCall(`api.${method} ${path}`, getRpcCallSource(), getRpcActiveTab())
  const response = await fetch(url)

  if (!response.ok) {
    const body = await readApiErrorPayload(response)
    logApiRequest(method, url, response.status, body)

    throw new LockApiError(
      body.error ?? `Lock API request failed (${response.status}).`,
      response.status,
      resolveApiErrorCode(body.code, response.status),
      body.details,
    )
  }

  logApiRequest(method, url, response.status)
  return response.json() as Promise<T>
}

export { LockApiError, type LockApiErrorCode } from './lockApiError'

export async function fetchLockFromApi(lockAccount: string): Promise<LockRecord | null> {
  try {
    const result = await fetchJson<{ lock: LockRecord | null }>(
      `/locks/${encodeURIComponent(lockAccount)}`,
    )

    return result.lock
  } catch (error) {
    if (error instanceof LockApiError) {
      throw error
    }

    return null
  }
}

export async function searchLocksFromApi(
  query: string,
  field: LockSearchField = 'all',
): Promise<LockRecord[]> {
  const params = new URLSearchParams()

  if (query.trim()) {
    params.set('q', query.trim())
  }

  if (field !== 'all') {
    params.set('field', field)
  }

  const suffix = params.toString() ? `?${params.toString()}` : ''

  return fetchJson<{ locks: LockRecord[] }>(`/locks${suffix}`).then((result) => result.locks)
}

export async function fetchWalletLocksFromApi(walletAddress: string): Promise<LockRecord[]> {
  const result = await fetchJson<{ locks: LockRecord[] }>(
    `/locks?owner=${encodeURIComponent(walletAddress)}`,
  )

  return result.locks
}

export async function fetchProgramInfoFromApi(): Promise<{
  programId: string
  repository: string
  verification: string
  dexRecognition: string
}> {
  return fetchJson('/program')
}
