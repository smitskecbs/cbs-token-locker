import { AccountRole, createNoopSigner, type Instruction } from '@solana/kit'
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
} from '@solana-program/token'
import type { Address } from '@solana/kit'

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  CBS_LOCKER_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from './programId'
import { encodeCreateLockArgs } from './layout'
import { UNLOCK_DISCRIMINATOR } from './discriminators'
import { findLockAccountAddress, findVaultAddress } from './pda'

export type CreateLockInstructionPlan = {
  lockAccount: Address
  vault: Address
  ownerTokenAccount: Address
  instructions: Instruction[]
}

export async function buildCreateLockInstructions(input: {
  owner: Address
  mint: Address
  amount: bigint
  unlockTimestamp: number
  lockSeed: bigint
  tokenType: number
  projectName: string
}): Promise<CreateLockInstructionPlan> {
  const [lockAccount] = await findLockAccountAddress(input.owner, input.mint, input.lockSeed)
  const [vault] = await findVaultAddress(lockAccount)
  const [ownerTokenAccount] = await findAssociatedTokenPda({
    owner: input.owner,
    mint: input.mint,
    tokenProgram: TOKEN_PROGRAM_ID,
  })

  const createAtaInstruction = getCreateAssociatedTokenIdempotentInstruction({
    payer: createNoopSigner(input.owner),
    ata: ownerTokenAccount,
    owner: input.owner,
    mint: input.mint,
    tokenProgram: TOKEN_PROGRAM_ID,
  })

  const createLockData = encodeCreateLockArgs(
    input.amount,
    input.unlockTimestamp,
    input.lockSeed,
    input.tokenType,
    input.projectName,
  )

  const createLockInstruction: Instruction = {
    programAddress: CBS_LOCKER_PROGRAM_ID,
    accounts: [
      { address: input.owner, role: AccountRole.WRITABLE_SIGNER },
      { address: lockAccount, role: AccountRole.WRITABLE },
      { address: input.mint, role: AccountRole.READONLY },
      { address: vault, role: AccountRole.WRITABLE },
      { address: ownerTokenAccount, role: AccountRole.WRITABLE },
      { address: TOKEN_PROGRAM_ID, role: AccountRole.READONLY },
      { address: ASSOCIATED_TOKEN_PROGRAM_ID, role: AccountRole.READONLY },
      { address: SYSTEM_PROGRAM_ID, role: AccountRole.READONLY },
    ],
    data: createLockData,
  }

  return {
    lockAccount,
    vault,
    ownerTokenAccount,
    instructions: [createAtaInstruction, createLockInstruction],
  }
}

export type UnlockInstructionPlan = {
  lockAccount: Address
  vault: Address
  ownerTokenAccount: Address
  instructions: Instruction[]
}

export async function buildUnlockInstructions(input: {
  owner: Address
  lockAccount: Address
  mint: Address
  vault: Address
  lockSeed: bigint
  tokenProgram?: Address
  createOwnerAta?: boolean
}): Promise<UnlockInstructionPlan> {
  const tokenProgram = input.tokenProgram ?? TOKEN_PROGRAM_ID
  const [ownerTokenAccount] = await findAssociatedTokenPda({
    owner: input.owner,
    mint: input.mint,
    tokenProgram,
  })

  const unlockInstruction: Instruction = {
    programAddress: CBS_LOCKER_PROGRAM_ID,
    accounts: [
      { address: input.owner, role: AccountRole.WRITABLE_SIGNER },
      { address: input.lockAccount, role: AccountRole.WRITABLE },
      { address: input.vault, role: AccountRole.WRITABLE },
      { address: ownerTokenAccount, role: AccountRole.WRITABLE },
      { address: tokenProgram, role: AccountRole.READONLY },
    ],
    data: UNLOCK_DISCRIMINATOR,
  }

  const instructions: Instruction[] = []

  if (input.createOwnerAta !== false) {
    instructions.push(
      getCreateAssociatedTokenIdempotentInstruction({
        payer: createNoopSigner(input.owner),
        ata: ownerTokenAccount,
        owner: input.owner,
        mint: input.mint,
        tokenProgram,
      }),
    )
  }

  instructions.push(unlockInstruction)

  return {
    lockAccount: input.lockAccount,
    vault: input.vault,
    ownerTokenAccount,
    instructions,
  }
}
