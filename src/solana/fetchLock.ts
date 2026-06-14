import {
  address,
  assertIsAddress,
  fetchEncodedAccount,
  type Address,
} from '@solana/kit'

import type { LockRecord } from '../types/lock'
import { parseTokenLockAccount } from './layout'
import { CBS_LOCKER_PROGRAM_ID } from './programId'
import type { SolanaNetwork } from './config'
import { getSolanaRpc } from './rpc'
import { verifyOnChainLock } from './verify'

export function toLockRecord(
  lockAccount: Address,
  parsed: NonNullable<ReturnType<typeof parseTokenLockAccount>>,
  verification: { verified: boolean },
  createSignature?: string,
): LockRecord {
  return {
    lockAccount,
    owner: parsed.owner,
    mint: parsed.mint,
    vault: parsed.vault,
    amount: parsed.amount.toString(),
    unlockAt: new Date(parsed.unlockTimestamp * 1000).toISOString(),
    createdAt: new Date(parsed.createdAt * 1000).toISOString(),
    lockSeed: parsed.lockSeed.toString(),
    tokenType: parsed.tokenType,
    isUnlocked: parsed.isUnlocked,
    tokenProgram: parsed.tokenProgram,
    projectName: parsed.projectName,
    programId: CBS_LOCKER_PROGRAM_ID,
    onChainVerified: verification.verified,
    createSignature,
  }
}

export async function fetchOnChainLock(
  lockAccountAddress: string,
  network?: SolanaNetwork,
): Promise<LockRecord | null> {
  try {
    assertIsAddress(lockAccountAddress)
  } catch {
    return null
  }

  const lockAccount = address(lockAccountAddress)
  const rpc = getSolanaRpc(network)
  const encodedAccount = await fetchEncodedAccount(rpc, lockAccount)

  if (!encodedAccount.exists || encodedAccount.programAddress !== CBS_LOCKER_PROGRAM_ID) {
    return null
  }

  const parsed = parseTokenLockAccount(encodedAccount.data)

  if (!parsed) {
    return null
  }

  const verification = await verifyOnChainLock(lockAccount, network)

  return toLockRecord(lockAccount, parsed, verification)
}
