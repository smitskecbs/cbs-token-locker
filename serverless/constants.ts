import { address, type Address } from '@solana/kit'

export const CBS_LOCKER_PROGRAM_ID: Address = address(
  process.env.VITE_CBS_LOCKER_PROGRAM_ID?.trim() ||
    'DA1sh6XTa13QQ23sLNdcPfCZF5SGMKXXYLxcfAJYcCmU',
)
