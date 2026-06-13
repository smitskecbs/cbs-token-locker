import {
  address,
  assertIsAddress,
  type Address,
  type Base58EncodedBytes,
} from '@solana/kit'

import type { CreateLockInput, LockRecord } from '../types/lock'
import type { SolanaWalletProvider } from '../wallet'
import { getSelectedClusterLabel } from './cluster'
import { runCreateLockFlow, CreateLockFlowError } from './createLockFlow'
import { formatLockerError } from './errors'
import { fetchOnChainLock, toLockRecord } from './fetchLock'
import { parseTokenLockAccount } from './layout'
import { unlockOnChainLockWithFlow, UnlockFlowError } from './unlockFlow'
import { CBS_LOCKER_PROGRAM_ID } from './programId'
import { getSolanaRpc } from './rpc'
import type { SimulationDiagnostics } from './simulationDiagnostics'
import { verifyOnChainLock } from './verify'

export class OnChainLockerError extends Error {
  readonly diagnostics?: SimulationDiagnostics

  constructor(message: string, diagnostics?: SimulationDiagnostics) {
    super(message)
    this.name = 'OnChainLockerError'
    this.diagnostics = diagnostics
  }
}

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

export { fetchOnChainLock, toLockRecord } from './fetchLock'

export async function fetchLocksByOwner(ownerAddress: string): Promise<LockRecord[]> {
  assertIsAddress(ownerAddress)

  const rpc = getSolanaRpc()
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

    const verification = await verifyOnChainLock(address(account.pubkey))
    locks.push(toLockRecord(address(account.pubkey), parsed, verification))
  }

  return locks.sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  })
}

export async function searchOnChainLocks(
  query: string,
  field: 'all' | 'lockId' | 'wallet' | 'mint' | 'project',
): Promise<LockRecord[]> {
  const normalizedQuery = query.trim()

  if (!normalizedQuery) {
    return []
  }

  if (field === 'lockId' || (field === 'all' && normalizedQuery.length >= 32)) {
    try {
      const lock = await fetchOnChainLock(normalizedQuery)

      if (lock) {
        return [lock]
      }
    } catch {
      // Fall through to owner/mint search.
    }
  }

  if (field === 'wallet' || field === 'all') {
    try {
      const locks = await fetchLocksByOwner(normalizedQuery)
      if (locks.length > 0) {
        return filterLocksByQuery(locks, normalizedQuery, field)
      }
    } catch {
      // Ignore invalid owner address.
    }
  }

  const rpc = getSolanaRpc()
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

    const verification = await verifyOnChainLock(lockAccount)
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

export async function createOnChainLock(
  input: CreateLockInput,
  walletProvider: SolanaWalletProvider,
): Promise<LockRecord> {
  try {
    return await runCreateLockFlow({
      createInput: input,
      walletProvider,
    })
  } catch (error) {
    if (error instanceof CreateLockFlowError) {
      throw new OnChainLockerError(error.message, error.diagnostics)
    }

    throw error
  }
}

export async function unlockOnChainLock(
  lockAccountAddress: string,
  walletProvider: SolanaWalletProvider,
  walletAddress: string,
): Promise<LockRecord> {
  try {
    return await unlockOnChainLockWithFlow(lockAccountAddress, walletProvider, walletAddress)
  } catch (error) {
    if (error instanceof UnlockFlowError) {
      throw new OnChainLockerError(error.message, error.diagnostics)
    }

    if (error instanceof OnChainLockerError) {
      throw error
    }

    throw new OnChainLockerError(formatLockerError(error, getSelectedClusterLabel()))
  }
}
