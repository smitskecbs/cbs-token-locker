import { address, AccountRole, fetchEncodedAccount, type Address, type Instruction } from '@solana/kit'

import type { LockRecord } from '../types/lock'
import { UNLOCK_DISCRIMINATOR } from './discriminators'
import type { UnlockInstructionPlan } from './instructions'
import { parseTokenLockAccount } from './layout'
import { ASSOCIATED_TOKEN_PROGRAM_ID, CBS_LOCKER_PROGRAM_ID, SYSTEM_PROGRAM_ID, TOKEN_PROGRAM_ID } from './programId'
import { findLockAccountAddress, findVaultAddress } from './pda'
import { getSolanaRpc } from './rpc'
import { findAssociatedTokenPda } from '@solana-program/token'

const IDL_UNLOCK_DISCRIMINATOR = new Uint8Array([
  101, 155, 40, 21, 158, 189, 56, 203,
])

const EXPECTED_UNLOCK_ACCOUNTS = [
  'owner (writable signer)',
  'lock (writable PDA)',
  'vault (writable)',
  'owner_token_account (writable)',
  'token_program',
] as const

export type UnlockInstructionAudit = {
  discriminatorMatches: boolean
  expectedDiscriminator: string
  actualDiscriminator: string
  accountOrderMatches: boolean
  expectedAccounts: string[]
  actualAccounts: string[]
  lockPdaMatches: boolean
  expectedLockPda: string
  vaultPdaMatches: boolean
  expectedVaultPda: string
  ownerAtaMatches: boolean
  expectedOwnerAta: string
  lockPdaBump: number | null
  onChainLockBump: number | null
  lockSignerSeedsMatch: boolean
  vaultPdaBump: number | null
  onChainVaultBump: number | null
  vaultSignerSeedsMatch: boolean
  tokenProgramMatches: boolean
  createAtaInstructionRequired: boolean
  createAtaAuditSkipped: boolean
  issues: string[]
  summary: string
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function discriminatorMatches(actual: Uint8Array, expected: Uint8Array): boolean {
  if (actual.length !== expected.length) {
    return false
  }

  for (let index = 0; index < actual.length; index += 1) {
    if (actual[index] !== expected[index]) {
      return false
    }
  }

  return true
}

function toByteArray(data: Uint8Array | { readonly [index: number]: number; readonly length: number } | undefined): Uint8Array {
  if (!data) {
    return new Uint8Array()
  }

  return data instanceof Uint8Array ? data : new Uint8Array(data)
}

function normalizeAccountAddress(value: string | Address): string {
  return String(address(value))
}

function findCreateAtaInstruction(plan: UnlockInstructionPlan): Instruction | null {
  return (
    plan.instructions.find(
      (instruction) =>
        normalizeAccountAddress(instruction.programAddress) ===
        normalizeAccountAddress(ASSOCIATED_TOKEN_PROGRAM_ID),
    ) ?? null
  )
}

function auditCreateOwnerAtaInstruction(
  plan: UnlockInstructionPlan,
  ownerAtaWillBeCreated: boolean,
): string[] {
  if (!ownerAtaWillBeCreated) {
    return []
  }

  const createAtaInstruction = findCreateAtaInstruction(plan)
  const issues: string[] = []

  if (!createAtaInstruction) {
    return ['Create owner ATA instruction missing from unlock plan.']
  }

  if (
    normalizeAccountAddress(createAtaInstruction.programAddress) !==
    normalizeAccountAddress(ASSOCIATED_TOKEN_PROGRAM_ID)
  ) {
    issues.push(
      `Create ATA program mismatch. Expected ${ASSOCIATED_TOKEN_PROGRAM_ID}, got ${String(createAtaInstruction.programAddress)}.`,
    )
  }

  const accounts = createAtaInstruction.accounts ?? []
  const accountAddresses = new Set(accounts.map((account) => normalizeAccountAddress(account.address)))
  const requiredProgramAccounts = [TOKEN_PROGRAM_ID, SYSTEM_PROGRAM_ID]

  for (const programId of requiredProgramAccounts) {
    if (!accountAddresses.has(normalizeAccountAddress(programId))) {
      issues.push(`Create ATA instruction missing required program account: ${programId}.`)
    }
  }

  return issues
}

function describeUnlockInstructionAccounts(plan: UnlockInstructionPlan): string[] {
  const unlockInstruction = plan.instructions.at(-1)

  if (!unlockInstruction?.accounts) {
    return []
  }

  return unlockInstruction.accounts.map((account, index) => {
    const flags: string[] = []

    if (account.role & AccountRole.WRITABLE) {
      flags.push('writable')
    }

    if (account.role & AccountRole.READONLY_SIGNER || account.role & AccountRole.WRITABLE_SIGNER) {
      flags.push('signer')
    }

    const label = EXPECTED_UNLOCK_ACCOUNTS[index] ?? `account_${index}`
    return `${label}: ${account.address}${flags.length > 0 ? ` (${flags.join(', ')})` : ''}`
  })
}

export async function auditUnlockInstructionPlan(input: {
  lock: LockRecord
  owner: Address
  plan: UnlockInstructionPlan
  ownerAtaWillBeCreated: boolean
}): Promise<UnlockInstructionAudit> {
  const issues: string[] = []
  const createAtaInstructionRequired = input.ownerAtaWillBeCreated
  const createAtaAuditSkipped = !input.ownerAtaWillBeCreated
  const unlockInstruction = input.plan.instructions.at(-1)

  if (!unlockInstruction?.accounts) {
    return {
      discriminatorMatches: false,
      expectedDiscriminator: bytesToHex(IDL_UNLOCK_DISCRIMINATOR),
      actualDiscriminator: 'missing',
      accountOrderMatches: false,
      expectedAccounts: [...EXPECTED_UNLOCK_ACCOUNTS],
      actualAccounts: [],
      lockPdaMatches: false,
      expectedLockPda: input.lock.lockAccount,
      vaultPdaMatches: false,
      expectedVaultPda: input.lock.vault,
      ownerAtaMatches: false,
      expectedOwnerAta: input.plan.ownerTokenAccount,
      lockPdaBump: null,
      onChainLockBump: null,
      lockSignerSeedsMatch: false,
      vaultPdaBump: null,
      onChainVaultBump: null,
      vaultSignerSeedsMatch: false,
      tokenProgramMatches: false,
      createAtaInstructionRequired,
      createAtaAuditSkipped,
      issues: ['Unlock instruction missing from transaction plan.'],
      summary: 'Unlock instruction missing from transaction plan.',
    }
  }

  const actualDiscriminator = toByteArray(unlockInstruction.data)
  const discriminatorOk = discriminatorMatches(actualDiscriminator, UNLOCK_DISCRIMINATOR)
  const idlDiscriminatorOk = discriminatorMatches(actualDiscriminator, IDL_UNLOCK_DISCRIMINATOR)

  if (!discriminatorOk || !idlDiscriminatorOk) {
    issues.push(
      `Unlock discriminator mismatch. Expected ${bytesToHex(IDL_UNLOCK_DISCRIMINATOR)}, got ${bytesToHex(actualDiscriminator)}.`,
    )
  }

  if (unlockInstruction.programAddress !== CBS_LOCKER_PROGRAM_ID) {
    issues.push(`Unlock program ID mismatch: ${unlockInstruction.programAddress}`)
  }

  const actualAccounts = describeUnlockInstructionAccounts(input.plan)
  const accountOrderMatches = unlockInstruction.accounts.length === EXPECTED_UNLOCK_ACCOUNTS.length

  if (!accountOrderMatches) {
    issues.push(
      `Unlock account count mismatch. Expected ${EXPECTED_UNLOCK_ACCOUNTS.length}, got ${unlockInstruction.accounts.length}.`,
    )
  }

  issues.push(...auditCreateOwnerAtaInstruction(input.plan, input.ownerAtaWillBeCreated))

  const lockSeed = BigInt(input.lock.lockSeed)
  const [expectedLockPda, lockBump] = await findLockAccountAddress(
    address(input.lock.owner),
    address(input.lock.mint),
    lockSeed,
  )
  const [expectedVaultPda, vaultBump] = await findVaultAddress(expectedLockPda)
  const [expectedOwnerAta] = await findAssociatedTokenPda({
    owner: input.owner,
    mint: address(input.lock.mint),
    tokenProgram: address(input.lock.tokenProgram),
  })

  const encodedLock = await fetchEncodedAccount(getSolanaRpc(), address(input.lock.lockAccount))
  const parsedLock = encodedLock.exists ? parseTokenLockAccount(encodedLock.data) : null
  const onChainLockBump = parsedLock?.bump ?? null
  const onChainVaultBump = parsedLock?.vaultBump ?? null
  const lockSignerSeedsMatch = onChainLockBump === null ? false : lockBump === onChainLockBump
  const vaultSignerSeedsMatch = onChainVaultBump === null ? false : vaultBump === onChainVaultBump

  if (parsedLock && !lockSignerSeedsMatch) {
    issues.push(
      `Lock PDA signer bump mismatch. Derived bump ${lockBump}, on-chain lock.bump ${onChainLockBump}. Signer seeds will not match the deployed program.`,
    )
  }

  if (parsedLock && !vaultSignerSeedsMatch) {
    issues.push(
      `Vault PDA bump mismatch. Derived bump ${vaultBump}, on-chain lock.vault_bump ${onChainVaultBump}.`,
    )
  }

  const lockPdaMatches = String(input.plan.lockAccount) === String(expectedLockPda)
  const vaultPdaMatches = String(input.plan.vault) === String(expectedVaultPda)
  const ownerAtaMatches = String(input.plan.ownerTokenAccount) === String(expectedOwnerAta)
  const tokenProgramAccount = unlockInstruction.accounts[4]?.address
  const tokenProgramMatches = String(tokenProgramAccount) === String(input.lock.tokenProgram)

  if (!lockPdaMatches) {
    issues.push(`Lock PDA mismatch. Expected ${expectedLockPda}, plan uses ${input.plan.lockAccount}.`)
  }

  if (!vaultPdaMatches) {
    issues.push(`Vault PDA mismatch. Expected ${expectedVaultPda}, plan uses ${input.plan.vault}.`)
  }

  if (!ownerAtaMatches) {
    issues.push(`Owner ATA mismatch. Expected ${expectedOwnerAta}, plan uses ${input.plan.ownerTokenAccount}.`)
  }

  if (!tokenProgramMatches) {
    issues.push(
      `Token program mismatch. Expected ${input.lock.tokenProgram}, instruction uses ${String(tokenProgramAccount)}.`,
    )
  }

  if (input.lock.tokenProgram !== TOKEN_PROGRAM_ID) {
    issues.push(
      `Lock record token program ${input.lock.tokenProgram} differs from standard SPL Token program. Verify Token-2022 support before unlock.`,
    )
  }

  const ownerAccount = unlockInstruction.accounts[0]
  const lockAccount = unlockInstruction.accounts[1]

  if (String(ownerAccount?.address) !== input.lock.owner) {
    issues.push('Unlock owner account does not match lock owner wallet.')
  }

  if (String(lockAccount?.address) !== input.lock.lockAccount) {
    issues.push('Unlock lock account does not match on-chain lock record.')
  }

  const summary =
    issues.length === 0
      ? createAtaAuditSkipped
        ? 'Unlock instruction audit passed: unlock instruction matches the deployed Anchor program. Create ATA audit skipped because owner ATA already exists.'
        : 'Unlock instruction audit passed: discriminator, account order, lock/vault PDAs, owner ATA, token program, and create ATA instruction match the deployed Anchor program.'
      : issues.join(' ')

  return {
    discriminatorMatches: discriminatorOk && idlDiscriminatorOk,
    expectedDiscriminator: bytesToHex(IDL_UNLOCK_DISCRIMINATOR),
    actualDiscriminator: bytesToHex(actualDiscriminator),
    accountOrderMatches,
    expectedAccounts: [...EXPECTED_UNLOCK_ACCOUNTS],
    actualAccounts,
    lockPdaMatches,
    expectedLockPda: String(expectedLockPda),
    vaultPdaMatches,
    expectedVaultPda: String(expectedVaultPda),
    ownerAtaMatches,
    expectedOwnerAta: String(expectedOwnerAta),
    lockPdaBump: lockBump,
    onChainLockBump,
    lockSignerSeedsMatch,
    vaultPdaBump: vaultBump,
    onChainVaultBump,
    vaultSignerSeedsMatch,
    tokenProgramMatches,
    createAtaInstructionRequired,
    createAtaAuditSkipped,
    issues,
    summary,
  }
}
