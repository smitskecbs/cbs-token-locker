export type LockApiErrorCode =
  | 'RPC_RATE_LIMIT'
  | 'RPC_ERROR'
  | 'INVALID_SEARCH_PARAMS'
  | 'INVALID_LOCK_ACCOUNT'
  | 'INVALID_CLUSTER'
  | 'UNKNOWN'

export class LockApiError extends Error {
  readonly status: number
  readonly code: LockApiErrorCode
  readonly details?: string

  constructor(
    message: string,
    status: number,
    code: LockApiErrorCode,
    details?: string,
  ) {
    super(message)
    this.name = 'LockApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}
