import {
  address,
  fetchEncodedAccount,
  getAddressEncoder,
  getProgramDerivedAddress,
  type Address,
} from '@solana/kit'

import type { SolanaNetwork } from './config'
import { getSolanaRpc } from './rpc'

const addressEncoder = getAddressEncoder()

const RAYDIUM_CLMM_PROGRAM_ID_BY_NETWORK = {
  mainnet: address('CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK'),
  devnet: address('DRayAUgENGQBKVaX8owNhgzkEDyoHTGVEGHVJT1E9pfH'),
} as const satisfies Record<SolanaNetwork, Address>

export function getRaydiumClmmProgramId(network: SolanaNetwork): Address {
  return RAYDIUM_CLMM_PROGRAM_ID_BY_NETWORK[network]
}

export async function findPersonalPositionStateAddress(
  mint: Address,
  network: SolanaNetwork,
): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: getRaydiumClmmProgramId(network),
    seeds: [new TextEncoder().encode('position'), addressEncoder.encode(mint)],
  })

  return pda
}

export async function isRaydiumClmmPositionMint(
  mint: Address,
  network: SolanaNetwork,
): Promise<boolean> {
  const rpc = getSolanaRpc(network)
  const programId = getRaydiumClmmProgramId(network)
  const positionPda = await findPersonalPositionStateAddress(mint, network)
  const encoded = await fetchEncodedAccount(rpc, positionPda)

  return encoded.exists && encoded.programAddress === programId
}

export async function filterRaydiumClmmPositionMints(
  mints: readonly Address[],
  network: SolanaNetwork,
): Promise<Set<string>> {
  if (mints.length === 0) {
    return new Set()
  }

  const rpc = getSolanaRpc(network)
  const programId = getRaydiumClmmProgramId(network)
  const positionPdas = await Promise.all(
    mints.map((mint) => findPersonalPositionStateAddress(mint, network)),
  )

  const validMints = new Set<string>()
  const chunkSize = 100

  for (let offset = 0; offset < positionPdas.length; offset += chunkSize) {
    const pdaChunk = positionPdas.slice(offset, offset + chunkSize)
    const mintChunk = mints.slice(offset, offset + chunkSize)
    const response = await rpc
      .getMultipleAccounts(pdaChunk, { commitment: 'confirmed' })
      .send()

    for (let index = 0; index < response.value.length; index += 1) {
      const account = response.value[index]

      if (account && account.owner === programId) {
        validMints.add(mintChunk[index]!)
      }
    }
  }

  return validMints
}
