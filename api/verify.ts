import { address, fetchEncodedAccount, type Address } from '@solana/kit'
import { fetchMaybeToken } from '@solana-program/token'

import { CBS_LOCKER_PROGRAM_ID } from './constants.js'
import { parseTokenLockAccount } from './layout.js'
import { findLockAccountAddress, findVaultAddress } from './pda.js'
import type { SolanaNetwork } from './cluster.js'
import type { OnChainVerification } from './types.js'
import { getSolanaRpc } from './rpc.js'

export async function verifyOnChainLock(
  lockAccount: Address,
  network: SolanaNetwork = 'devnet',
): Promise<OnChainVerification> {
  const rpc = getSolanaRpc(network)
  const encodedAccount = await fetchEncodedAccount(rpc, lockAccount)

  if (!encodedAccount.exists) {
    return {
      verified: false,
      reason: 'Lock account does not exist on-chain.',
    }
  }

  if (encodedAccount.programAddress !== CBS_LOCKER_PROGRAM_ID) {
    return {
      verified: false,
      reason: 'Account is not owned by the CBS Token Locker program.',
    }
  }

  const parsed = parseTokenLockAccount(encodedAccount.data)

  if (!parsed) {
    return {
      verified: false,
      reason: 'Lock account data does not match the CBS Token Locker layout.',
    }
  }

  const [expectedLockAccount] = await findLockAccountAddress(
    address(parsed.owner),
    address(parsed.mint),
    parsed.lockSeed,
  )

  if (expectedLockAccount !== lockAccount) {
    return {
      verified: false,
      reason: 'Lock account address does not match deterministic PDA seeds.',
    }
  }

  const [expectedVault] = await findVaultAddress(lockAccount)

  if (expectedVault !== parsed.vault) {
    return {
      verified: false,
      reason: 'Vault address does not match deterministic PDA derivation.',
    }
  }

  const vaultAccount = await fetchMaybeToken(rpc, address(parsed.vault))

  if (!vaultAccount.exists) {
    return {
      verified: false,
      reason: 'Vault token account does not exist on-chain.',
    }
  }

  if (vaultAccount.data.mint !== parsed.mint) {
    return {
      verified: false,
      reason: 'Vault mint does not match the lock record.',
    }
  }

  if (vaultAccount.data.owner !== lockAccount) {
    return {
      verified: false,
      reason: 'Vault authority is not the lock account.',
    }
  }

  if (!parsed.isUnlocked && vaultAccount.data.amount < parsed.amount) {
    return {
      verified: false,
      reason: 'Vault balance is lower than the locked amount.',
    }
  }

  if (parsed.isUnlocked && vaultAccount.data.amount > 0n) {
    return {
      verified: false,
      reason: `Lock is marked unlocked but vault still holds ${vaultAccount.data.amount.toString()} tokens.`,
    }
  }

  return {
    verified: true,
    reason: 'CBS verified on-chain',
  }
}
