import {
  address,
  assertIsAddress,
  type Address,
  type Base58EncodedBytes,
} from '@solana/kit'

import type { SolanaNetwork } from './cluster.js'
import { CBS_LOCKER_PROGRAM_ID } from './constants.js'
import { fetchOnChainLock, toLockRecord } from './fetchLock.js'
import { parseTokenLockAccount } from './layout.js'
import type { LockRecord, LockSearchField } from './types.js'
import { getSolanaRpc } from './rpc.js'
import { verifyOnChainLock } from './verify.js'

type ProgramAccountEntry = {
  pubkey: Address
  account: {
    data: [string, 'base64']
  }
}

function normalizeProgramAccountsResponse(
  response: ProgramAccountEntry[] | { value: ProgramAccountEntry[] },
): ProgramAccountEntry[] {
  return Array.isArray(response) ? response : response.value
}

export async function fetchLocksByOwner(
  ownerAddress: string,
  network: SolanaNetwork = 'devnet',
): Promise<LockRecord[]> {
  assertIsAddress(ownerAddress)

  const rpc = getSolanaRpc(network)
  const response = await rpc
    .getProgramAccounts(CBS_LOCKER_PROGRAM_ID, {
      encoding: 'base64',
      filters: [
        {
          memcmp: {
            offset: 8n,
            bytes: ownerAddress as unknown as Base58EncodedBytes,
            encoding: 'base58',
          },
        },
      ],
    })
    .send()

  const locks: LockRecord[] = []

  for (const account of normalizeProgramAccountsResponse(response)) {
    const data = Uint8Array.from(atob(account.account.data[0]), (char) => char.charCodeAt(0))
    const parsed = parseTokenLockAccount(data)

    if (!parsed) {
      continue
    }

    const verification = await verifyOnChainLock(address(account.pubkey), network)
    locks.push(toLockRecord(address(account.pubkey), parsed, verification))
  }

  return locks.sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  })
}

export async function searchOnChainLocks(
  query: string,
  field: LockSearchField = 'all',
  network: SolanaNetwork = 'devnet',
): Promise<LockRecord[]> {
  const normalizedQuery = query.trim()

  if (!normalizedQuery) {
    return []
  }

  if (field === 'lockId' || (field === 'all' && normalizedQuery.length >= 32)) {
    try {
      const lock = await fetchOnChainLock(normalizedQuery, network)

      if (lock) {
        return [lock]
      }
    } catch {
      // Fall through to owner/mint search.
    }
  }

  if (field === 'wallet' || field === 'all') {
    try {
      const locks = await fetchLocksByOwner(normalizedQuery, network)
      if (locks.length > 0) {
        return filterLocksByQuery(locks, normalizedQuery, field)
      }
    } catch {
      // Ignore invalid owner address.
    }
  }

  const rpc = getSolanaRpc(network)
  const response = await rpc
    .getProgramAccounts(CBS_LOCKER_PROGRAM_ID, {
      encoding: 'base64',
    })
    .send()

  const locks: LockRecord[] = []

  for (const account of normalizeProgramAccountsResponse(response)) {
    const data = Uint8Array.from(atob(account.account.data[0]), (char) => char.charCodeAt(0))
    const parsed = parseTokenLockAccount(data)

    if (!parsed) {
      continue
    }

    const lockAccount = address(account.pubkey)
    const matches =
      field === 'mint'
        ? parsed.mint === normalizedQuery
        : field === 'project'
          ? parsed.projectName.toLowerCase().includes(normalizedQuery.toLowerCase())
          : field === 'all'
            ? lockAccount === normalizedQuery ||
              parsed.owner === normalizedQuery ||
              parsed.mint === normalizedQuery ||
              parsed.projectName.toLowerCase().includes(normalizedQuery.toLowerCase())
            : false

    if (!matches) {
      continue
    }

    const verification = await verifyOnChainLock(lockAccount, network)
    locks.push(toLockRecord(lockAccount, parsed, verification))
  }

  return locks
}

function filterLocksByQuery(
  locks: LockRecord[],
  query: string,
  field: 'all' | 'wallet',
): LockRecord[] {
  if (field === 'wallet') {
    return locks
  }

  const normalized = query.toLowerCase()

  return locks.filter((lock) => {
    return (
      lock.lockAccount.toLowerCase().includes(normalized) ||
      lock.owner.toLowerCase().includes(normalized) ||
      lock.mint.toLowerCase().includes(normalized) ||
      lock.projectName.toLowerCase().includes(normalized)
    )
  })
}
