import {
  getAddressEncoder,
  getProgramDerivedAddress,
  type Address,
} from '@solana/kit'

import { CBS_LOCKER_PROGRAM_ID } from './constants.js'

const addressEncoder = getAddressEncoder()

export async function findLockAccountAddress(
  owner: Address,
  mint: Address,
  lockSeed: bigint,
): Promise<readonly [Address, number]> {
  const seedBytes = new Uint8Array(8)
  const view = new DataView(seedBytes.buffer)
  view.setBigUint64(0, lockSeed, true)

  return getProgramDerivedAddress({
    programAddress: CBS_LOCKER_PROGRAM_ID,
    seeds: [
      new TextEncoder().encode('lock'),
      addressEncoder.encode(owner),
      addressEncoder.encode(mint),
      seedBytes,
    ],
  })
}

export async function findVaultAddress(lockAccount: Address): Promise<readonly [Address, number]> {
  return getProgramDerivedAddress({
    programAddress: CBS_LOCKER_PROGRAM_ID,
    seeds: [new TextEncoder().encode('vault'), addressEncoder.encode(lockAccount)],
  })
}
