import { address, type Address } from '@solana/kit'

import type { SolanaNetwork } from './config'
import { getSelectedNetwork } from './cluster'

/** Production mainnet program ID. */
export const CBS_LOCKER_MAINNET_PROGRAM_ID =
  'DA1sh6XTa13QQ23sLNdcPfCZF5SGMKXXYLxcfAJYcCmU' as const

/** Devnet program ID for local and devnet testing. */
export const CBS_LOCKER_DEVNET_PROGRAM_ID =
  'Hcgw5545Q4prhCE8HgNaJtMKGqPkC64aek1aRbTdXW1u' as const

function readEnv(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env[key]?.trim()) {
    return process.env[key]!.trim()
  }

  if (typeof import.meta !== 'undefined' && import.meta.env?.[key]?.trim()) {
    return import.meta.env[key]!.trim()
  }

  return undefined
}

export function getCbsLockerProgramId(network?: SolanaNetwork): Address {
  const override = readEnv('VITE_CBS_LOCKER_PROGRAM_ID')

  if (override) {
    return address(override)
  }

  const cluster = network ?? getSelectedNetwork()

  return address(
    cluster === 'devnet' ? CBS_LOCKER_DEVNET_PROGRAM_ID : CBS_LOCKER_MAINNET_PROGRAM_ID,
  )
}

/**
 * CBS locker program for the selected cluster at module load.
 * Use getCbsLockerProgramId(network) when the cluster is explicit.
 */
export const CBS_LOCKER_PROGRAM_ID: Address = getCbsLockerProgramId()

export const TOKEN_PROGRAM_ID: Address = address(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
)

export const ASSOCIATED_TOKEN_PROGRAM_ID: Address = address(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
)

export const SYSTEM_PROGRAM_ID: Address = address(
  '11111111111111111111111111111111',
)

/** Token-2022 program ID — prepared for future support. */
export const TOKEN_2022_PROGRAM_ID: Address = address(
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
)
