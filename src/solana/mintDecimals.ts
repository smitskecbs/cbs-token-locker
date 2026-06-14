import { address } from '@solana/kit'
import { fetchMaybeMint } from '@solana-program/token'

import { withRpcCallSource } from '../state/rpcCallTracker'

import { getSolanaRpc } from './rpc'

const decimalsCache = new Map<string, number>()
const pendingMintDecimals = new Map<string, Promise<number | null>>()

export function getCachedMintDecimals(mintAddress: string): number | null {
  const normalized = mintAddress.trim()
  const cached = decimalsCache.get(normalized)

  return cached !== undefined ? cached : null
}

async function fetchMintDecimalsOnce(normalizedMint: string): Promise<number | null> {
  return withRpcCallSource('mint-decimals:fetch', async () => {
    const rpc = getSolanaRpc()
    const mintAccount = await fetchMaybeMint(rpc, address(normalizedMint))

    if (!mintAccount.exists) {
      return null
    }

    return mintAccount.data.decimals
  })
}

export async function fetchMintDecimals(mintAddress: string): Promise<number | null> {
  const normalized = mintAddress.trim()
  const cached = decimalsCache.get(normalized)

  if (cached !== undefined) {
    return cached
  }

  const pending = pendingMintDecimals.get(normalized)

  if (pending) {
    return pending
  }

  const request = fetchMintDecimalsOnce(normalized).then((decimals) => {
    if (decimals !== null) {
      decimalsCache.set(normalized, decimals)
    }

    return decimals
  })

  pendingMintDecimals.set(normalized, request)

  try {
    return await request
  } finally {
    pendingMintDecimals.delete(normalized)
  }
}

export async function fetchMintDecimalsForLock(mintAddress: string): Promise<number | null> {
  const cached = getCachedMintDecimals(mintAddress)

  if (cached !== null) {
    return cached
  }

  return fetchMintDecimals(mintAddress)
}
