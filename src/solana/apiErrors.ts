import { isSolanaError } from '@solana/kit'

import { RPC_RATE_LIMIT_MESSAGE } from '../state/rpcActivityStore'
import { isRpcRateLimitError } from './rpcFetch'

export type ApiErrorCode =
  | 'RPC_RATE_LIMIT'
  | 'RPC_ERROR'
  | 'INVALID_SEARCH_PARAMS'
  | 'INVALID_LOCK_ACCOUNT'
  | 'INVALID_CLUSTER'

export type ApiErrorBody = {
  error: string
  code: ApiErrorCode
  details?: string
}

export type ApiErrorResponse = {
  status: number
  body: ApiErrorBody
}

const RPC_FAILURE_MESSAGE = 'Unable to load on-chain locks from Solana RPC.'

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  if (isSolanaError(error)) {
    return error.message
  }

  return 'Unknown error'
}

export function classifyApiError(error: unknown): ApiErrorResponse {
  if (isRpcRateLimitError(error)) {
    return {
      status: 429,
      body: {
        error: RPC_RATE_LIMIT_MESSAGE,
        code: 'RPC_RATE_LIMIT',
        details: getErrorMessage(error),
      },
    }
  }

  const message = getErrorMessage(error)
  const normalized = message.toLowerCase()

  if (
    normalized.includes('429') ||
    normalized.includes('too many requests') ||
    normalized.includes('rate limit') ||
    normalized.includes('rate-limiting')
  ) {
    return {
      status: 429,
      body: {
        error: RPC_RATE_LIMIT_MESSAGE,
        code: 'RPC_RATE_LIMIT',
        details: message,
      },
    }
  }

  return {
    status: 503,
    body: {
      error: RPC_FAILURE_MESSAGE,
      code: 'RPC_ERROR',
      details: message,
    },
  }
}

export function invalidSearchParamsResponse(details?: string): ApiErrorResponse {
  return {
    status: 400,
    body: {
      error: 'Invalid lock search parameters.',
      code: 'INVALID_SEARCH_PARAMS',
      ...(details ? { details } : {}),
    },
  }
}

export function invalidLockAccountResponse(details?: string): ApiErrorResponse {
  return {
    status: 400,
    body: {
      error: 'Invalid lock account address.',
      code: 'INVALID_LOCK_ACCOUNT',
      ...(details ? { details } : {}),
    },
  }
}

export function invalidClusterResponse(details?: string): ApiErrorResponse {
  return {
    status: 400,
    body: {
      error: 'Invalid cluster. Use cluster=devnet or cluster=mainnet.',
      code: 'INVALID_CLUSTER',
      ...(details ? { details } : {}),
    },
  }
}
