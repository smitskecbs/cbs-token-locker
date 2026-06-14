import { getAddressDecoder } from '@solana/addresses'

import { TOKEN_LOCK_ACCOUNT_DISCRIMINATOR } from './discriminators.js'
import type { TokenType } from './types.js'

const addressDecoder = getAddressDecoder()

export const MAX_PROJECT_NAME_LEN = 48
export const TOKEN_LOCK_ACCOUNT_SIZE = 220

export type OnChainTokenLock = {
  owner: string
  mint: string
  vault: string
  amount: bigint
  unlockTimestamp: number
  createdAt: number
  lockSeed: bigint
  tokenType: TokenType
  isUnlocked: boolean
  bump: number
  vaultBump: number
  tokenProgram: string
  projectName: string
}

function decodePubkeyBytes(bytes: Uint8Array): string {
  return addressDecoder.decode(bytes)
}

export function parseTokenLockAccount(data: Uint8Array): OnChainTokenLock | null {
  if (data.length < TOKEN_LOCK_ACCOUNT_SIZE) {
    return null
  }

  for (let index = 0; index < TOKEN_LOCK_ACCOUNT_DISCRIMINATOR.length; index += 1) {
    if (data[index] !== TOKEN_LOCK_ACCOUNT_DISCRIMINATOR[index]) {
      return null
    }
  }

  let offset = 8

  const ownerBytes = data.slice(offset, offset + 32)
  offset += 32
  const mintBytes = data.slice(offset, offset + 32)
  offset += 32
  const vaultBytes = data.slice(offset, offset + 32)
  offset += 32

  const amount = readU64(data, offset)
  offset += 8
  const unlockTimestamp = readI64(data, offset)
  offset += 8
  const createdAt = readI64(data, offset)
  offset += 8
  const lockSeed = readU64(data, offset)
  offset += 8

  const tokenTypeByte = data[offset]
  offset += 1
  const isUnlocked = data[offset] === 1
  offset += 1
  const bump = data[offset]
  offset += 1
  const vaultBump = data[offset]
  offset += 1

  const tokenProgramBytes = data.slice(offset, offset + 32)
  offset += 32

  const projectNameBytes = data.slice(offset, offset + MAX_PROJECT_NAME_LEN)
  const projectName = new TextDecoder().decode(
    projectNameBytes.slice(0, projectNameEnd(projectNameBytes)),
  )

  return {
    owner: decodePubkeyBytes(ownerBytes),
    mint: decodePubkeyBytes(mintBytes),
    vault: decodePubkeyBytes(vaultBytes),
    amount,
    unlockTimestamp,
    createdAt,
    lockSeed,
    tokenType: tokenTypeByte === 1 ? 'lp' : 'spl',
    isUnlocked,
    bump,
    vaultBump,
    tokenProgram: decodePubkeyBytes(tokenProgramBytes),
    projectName,
  }
}

function projectNameEnd(bytes: Uint8Array): number {
  let end = bytes.length

  while (end > 0 && bytes[end - 1] === 0) {
    end -= 1
  }

  return end
}

function readU64(data: Uint8Array, offset: number): bigint {
  const view = new DataView(data.buffer, data.byteOffset + offset, 8)
  return view.getBigUint64(0, true)
}

function readI64(data: Uint8Array, offset: number): number {
  const view = new DataView(data.buffer, data.byteOffset + offset, 8)
  return Number(view.getBigInt64(0, true))
}
