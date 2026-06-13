import { address, type Address } from '@solana/kit'

/**
 * Stable public program ID for CBS Token Locker.
 * Replace only via governed deployment; document all changes in docs/PROGRAM.md.
 */
export const CBS_LOCKER_PROGRAM_ID: Address = address(
  readEnv('VITE_CBS_LOCKER_PROGRAM_ID') ||
    'DA1sh6XTa13QQ23sLNdcPfCZF5SGMKXXYLxcfAJYcCmU',
)

function readEnv(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env[key]?.trim()) {
    return process.env[key]!.trim()
  }

  if (typeof import.meta !== 'undefined' && import.meta.env?.[key]?.trim()) {
    return import.meta.env[key]!.trim()
  }

  return undefined
}

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
