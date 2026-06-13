import type { Blockhash } from '@solana/rpc-types'

import { isDevelopmentMode } from '../state/debugStore'
import { safeJsonStringify } from '../utils/safeSerialize'
import { getSolanaRpc } from './rpc'

export const BLOCKHASH_EXPIRED_USER_MESSAGE =
  'The transaction blockhash expired. Please try again.'

export type FreshBlockhashInfo = {
  blockhash: Blockhash
  lastValidBlockHeight: bigint
  currentBlockHeight: bigint | null
  fetchedAtMs: number
}

export type BlockhashLifecycleSnapshot = {
  blockhash: string
  lastValidBlockHeight: string
  currentBlockHeight: string | null
  blockhashFetchedAtMs: number
  msSinceBlockhashFetch: number | null
}

export function isBlockhashNotFoundError(error: unknown): boolean {
  if (!error) {
    return false
  }

  if (typeof error === 'string') {
    const normalized = error.toLowerCase()
    return normalized.includes('blockhashnotfound') || normalized.includes('block hash not found')
  }

  if (typeof error === 'object') {
    if ('BlockhashNotFound' in error) {
      return true
    }

    const serialized = safeJsonStringify(error).toLowerCase()
    return serialized.includes('blockhashnotfound')
  }

  return false
}

export function isBlockHeightExpired(
  lastValidBlockHeight: bigint,
  currentBlockHeight: bigint,
): boolean {
  return currentBlockHeight > lastValidBlockHeight
}

export async function fetchCurrentBlockHeight(): Promise<bigint | null> {
  try {
    return await getSolanaRpc().getBlockHeight({ commitment: 'confirmed' }).send()
  } catch {
    return null
  }
}

export async function fetchFreshBlockhashInfo(): Promise<FreshBlockhashInfo> {
  const rpc = getSolanaRpc()
  const fetchedAtMs = Date.now()

  const [{ value: latestBlockhash }, currentBlockHeight] = await Promise.all([
    rpc.getLatestBlockhash({ commitment: 'confirmed' }).send(),
    fetchCurrentBlockHeight(),
  ])

  return {
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    currentBlockHeight,
    fetchedAtMs,
  }
}

export function createBlockhashLifecycleSnapshot(input: {
  blockhash: Blockhash | string
  lastValidBlockHeight: bigint
  currentBlockHeight: bigint | null
  fetchedAtMs: number
  referenceTimeMs?: number
}): BlockhashLifecycleSnapshot {
  const referenceTimeMs = input.referenceTimeMs ?? Date.now()

  return {
    blockhash: String(input.blockhash),
    lastValidBlockHeight: String(input.lastValidBlockHeight),
    currentBlockHeight: input.currentBlockHeight === null ? null : String(input.currentBlockHeight),
    blockhashFetchedAtMs: input.fetchedAtMs,
    msSinceBlockhashFetch: Math.max(0, referenceTimeMs - input.fetchedAtMs),
  }
}

export function logBlockhashLifecycle(
  stage: string,
  snapshot: BlockhashLifecycleSnapshot,
  details: Record<string, unknown> = {},
): void {
  if (!isDevelopmentMode()) {
    return
  }

  console.info(`[CBS Locker TX] blockhash ${stage}`, safeJsonStringify({
    ...snapshot,
    ...details,
  }))
}

export async function isCompiledBlockhashStillValid(input: {
  lastValidBlockHeight: bigint
}): Promise<boolean> {
  const currentBlockHeight = await fetchCurrentBlockHeight()

  if (currentBlockHeight === null) {
    return true
  }

  return !isBlockHeightExpired(input.lastValidBlockHeight, currentBlockHeight)
}
