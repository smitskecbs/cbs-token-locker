import { address, assertIsAddress, type Address, type Instruction } from '@solana/kit'
import { fetchMaybeMint, fetchMaybeToken, findAssociatedTokenPda } from '@solana-program/token'

import { buildCreateLockInstructions, buildUnlockInstructions } from '../../src/solana/instructions.ts'
import { fetchOnChainLock } from '../../src/solana/fetchLock.ts'
import { verifyOnChainLock } from '../../src/solana/verify.ts'
import { PHASE0_NETWORK, assertPhase0DevnetOnly, getPhase0Rpc, loadPhase0Signer, TOKEN_PROGRAM_ID } from './proof-env.ts'
import { signAndSendPhase0Instructions, simulatePhase0Instructions } from './proof-sign.ts'

const DEFAULT_UNLOCK_DELAY_SECONDS = 30
const DEFAULT_PROJECT_NAME = 'Phase0 Track B'
const NFT_AMOUNT = 1n

function logStep(step: string, details?: Record<string, unknown>): void {
  if (details) {
    console.info(`[Phase0 Track B] ${step}`, details)
  } else {
    console.info(`[Phase0 Track B] ${step}`)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function resolveMintAddress(): Address {
  const fromArg = process.argv[2]?.trim()
  const fromEnv = process.env.PHASE0_TRACK_B_MINT?.trim()
  const mintText = fromArg || fromEnv

  if (!mintText) {
    throw new Error(
      'Missing synthetic NFT mint. Set PHASE0_TRACK_B_MINT or pass the mint as the first CLI argument.',
    )
  }

  assertIsAddress(mintText)
  return address(mintText)
}

function resolveLockSeed(): bigint {
  const fromEnv = process.env.PHASE0_LOCK_SEED?.trim()

  if (fromEnv) {
    const parsed = BigInt(fromEnv)

    if (parsed < 0n) {
      throw new Error('PHASE0_LOCK_SEED must be a non-negative integer.')
    }

    return parsed
  }

  return BigInt(Date.now())
}

function resolveUnlockDelaySeconds(): number {
  const fromEnv = process.env.PHASE0_UNLOCK_DELAY_SECONDS?.trim()

  if (!fromEnv) {
    return DEFAULT_UNLOCK_DELAY_SECONDS
  }

  const parsed = Number(fromEnv)

  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error('PHASE0_UNLOCK_DELAY_SECONDS must be a positive number.')
  }

  return Math.floor(parsed)
}

function resolveProjectName(): string {
  return process.env.PHASE0_PROJECT_NAME?.trim() || DEFAULT_PROJECT_NAME
}

async function fetchOwnerMintBalance(owner: Address, mint: Address): Promise<bigint> {
  const rpc = getPhase0Rpc()
  const [ownerTokenAccount] = await findAssociatedTokenPda({
    owner,
    mint,
    tokenProgram: TOKEN_PROGRAM_ID,
  })
  const tokenAccount = await fetchMaybeToken(rpc, ownerTokenAccount)

  return tokenAccount.exists ? tokenAccount.data.amount : 0n
}

async function assertSyntheticNftPreconditions(owner: Address, mint: Address): Promise<void> {
  const rpc = getPhase0Rpc()
  const mintAccount = await fetchMaybeMint(rpc, mint)

  if (!mintAccount.exists) {
    throw new Error(`Mint ${mint} does not exist on devnet.`)
  }

  if (mintAccount.data.decimals !== 0) {
    throw new Error(
      `Mint ${mint} has decimals=${mintAccount.data.decimals}; Track B requires decimals=0.`,
    )
  }

  const ownerBalance = await fetchOwnerMintBalance(owner, mint)

  if (ownerBalance !== NFT_AMOUNT) {
    throw new Error(
      `Owner ${owner} must hold exactly 1 token of mint ${mint}; current balance=${ownerBalance.toString()}.`,
    )
  }

  logStep('preconditions passed', {
    owner,
    mint,
    decimals: mintAccount.data.decimals,
    ownerBalance: ownerBalance.toString(),
  })
}

async function assertLockedState(input: {
  lockAccount: Address
  vault: Address
  owner: Address
  mint: Address
  lockSeed: bigint
}): Promise<void> {
  const verification = await verifyOnChainLock(input.lockAccount, PHASE0_NETWORK)

  if (!verification.verified) {
    throw new Error(`Post-create lock verification failed: ${verification.reason}`)
  }

  const lock = await fetchOnChainLock(input.lockAccount, PHASE0_NETWORK)

  if (!lock) {
    throw new Error('Lock account could not be fetched after create.')
  }

  if (lock.isUnlocked) {
    throw new Error('Lock is already marked unlocked after create.')
  }

  if (lock.amount !== NFT_AMOUNT.toString()) {
    throw new Error(`Expected locked amount 1; got ${lock.amount}.`)
  }

  if (lock.tokenType !== 'spl') {
    throw new Error(`Expected token_type SPL (0); parsed as ${lock.tokenType}.`)
  }

  if (lock.lockSeed !== input.lockSeed.toString()) {
    throw new Error(`Lock seed mismatch: expected ${input.lockSeed.toString()}, got ${lock.lockSeed}.`)
  }

  const rpc = getPhase0Rpc()
  const vaultAccount = await fetchMaybeToken(rpc, input.vault)

  if (!vaultAccount.exists || vaultAccount.data.amount !== NFT_AMOUNT) {
    throw new Error(
      `Vault ${input.vault} should hold exactly 1 token after create; amount=${vaultAccount.exists ? vaultAccount.data.amount.toString() : 'missing'}.`,
    )
  }

  const ownerBalance = await fetchOwnerMintBalance(input.owner, input.mint)

  if (ownerBalance !== 0n) {
    throw new Error(
      `Owner ATA should be empty after lock; balance=${ownerBalance.toString()}.`,
    )
  }

  logStep('locked state verified', {
    lockAccount: input.lockAccount,
    vault: input.vault,
    amount: lock.amount,
    tokenType: lock.tokenType,
    unlockAt: lock.unlockAt,
  })
}

async function waitUntilUnlock(unlockTimestamp: number): Promise<void> {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const waitSeconds = unlockTimestamp - nowSeconds

  if (waitSeconds > 0) {
    logStep('waiting for unlock time', { waitSeconds, unlockTimestamp })
    await sleep(waitSeconds * 1000 + 2_000)
  } else {
    logStep('unlock time already reached', { unlockTimestamp, nowSeconds })
  }
}

async function assertUnlockedState(input: {
  lockAccount: Address
  vault: Address
  owner: Address
  mint: Address
}): Promise<void> {
  const verification = await verifyOnChainLock(input.lockAccount, PHASE0_NETWORK)

  if (!verification.verified) {
    throw new Error(`Post-unlock verification failed: ${verification.reason}`)
  }

  const lock = await fetchOnChainLock(input.lockAccount, PHASE0_NETWORK)

  if (!lock) {
    throw new Error('Lock account could not be fetched after unlock.')
  }

  if (!lock.isUnlocked) {
    throw new Error('Lock is_unlocked flag is still false after unlock.')
  }

  const rpc = getPhase0Rpc()
  const vaultAccount = await fetchMaybeToken(rpc, input.vault)
  const vaultBalance = vaultAccount.exists ? vaultAccount.data.amount : 0n

  if (vaultBalance !== 0n) {
    throw new Error(`Vault should be empty after unlock; balance=${vaultBalance.toString()}.`)
  }

  const ownerBalance = await fetchOwnerMintBalance(input.owner, input.mint)

  if (ownerBalance !== NFT_AMOUNT) {
    throw new Error(
      `Owner should hold exactly 1 NFT after unlock; balance=${ownerBalance.toString()}.`,
    )
  }

  logStep('unlock state verified', {
    lockAccount: input.lockAccount,
    ownerBalance: ownerBalance.toString(),
    vaultBalance: vaultBalance.toString(),
    isUnlocked: lock.isUnlocked,
  })
}

async function runSimulationOrThrow(
  stage: string,
  instructions: readonly Instruction[],
): Promise<void> {
  const simulation = await simulatePhase0Instructions(instructions)

  if (simulation.err) {
    throw new Error(
      `${stage} simulation failed: ${JSON.stringify(simulation.err)}\nLogs:\n${simulation.logs.join('\n')}`,
    )
  }

  logStep(`${stage} simulation passed`, {
    unitsConsumed: simulation.unitsConsumed ?? null,
  })
}

async function main(): Promise<void> {
  assertPhase0DevnetOnly()

  const mint = resolveMintAddress()
  const signer = await loadPhase0Signer()
  const owner = signer.address
  const lockSeed = resolveLockSeed()
  const unlockDelaySeconds = resolveUnlockDelaySeconds()
  const projectName = resolveProjectName()
  const unlockTimestamp = Math.floor(Date.now() / 1000) + unlockDelaySeconds

  logStep('starting Track B synthetic SPL NFT proof', {
    network: PHASE0_NETWORK,
    owner,
    mint,
    lockSeed: lockSeed.toString(),
    unlockDelaySeconds,
    unlockTimestamp,
    projectName,
  })

  await assertSyntheticNftPreconditions(owner, mint)

  const createPlan = await buildCreateLockInstructions({
    owner,
    mint,
    amount: NFT_AMOUNT,
    unlockTimestamp,
    lockSeed,
    tokenType: 0,
    projectName,
    tokenProgram: TOKEN_PROGRAM_ID,
  })

  logStep('create_lock plan ready', {
    lockAccount: createPlan.lockAccount,
    vault: createPlan.vault,
    ownerTokenAccount: createPlan.ownerTokenAccount,
    instructionCount: createPlan.instructions.length,
  })

  await runSimulationOrThrow('create_lock', createPlan.instructions)

  const createResult = await signAndSendPhase0Instructions(createPlan.instructions)

  logStep('create_lock confirmed', { signature: createResult.signature })

  await assertLockedState({
    lockAccount: createPlan.lockAccount,
    vault: createPlan.vault,
    owner,
    mint,
    lockSeed,
  })

  await waitUntilUnlock(unlockTimestamp)

  const unlockPlan = await buildUnlockInstructions({
    owner,
    lockAccount: createPlan.lockAccount,
    mint,
    vault: createPlan.vault,
    lockSeed,
  })

  logStep('unlock plan ready', {
    lockAccount: unlockPlan.lockAccount,
    vault: unlockPlan.vault,
    ownerTokenAccount: unlockPlan.ownerTokenAccount,
    instructionCount: unlockPlan.instructions.length,
  })

  await runSimulationOrThrow('unlock', unlockPlan.instructions)

  const unlockResult = await signAndSendPhase0Instructions(unlockPlan.instructions)

  logStep('unlock confirmed', { signature: unlockResult.signature })

  await assertUnlockedState({
    lockAccount: createPlan.lockAccount,
    vault: createPlan.vault,
    owner,
    mint,
  })

  console.info('[Phase0 Track B] PASS — synthetic legacy SPL NFT lock and unlock verified on devnet', {
    mint,
    lockAccount: createPlan.lockAccount,
    vault: createPlan.vault,
    createSignature: createResult.signature,
    unlockSignature: unlockResult.signature,
    checks: [
      'mint decimals = 0',
      'owner balance = 1 before lock',
      'create_lock amount = 1, token_type = 0',
      'lock account and vault verified after create',
      'unlock after unlock_timestamp',
      'owner balance = 1 and vault empty after unlock',
      'lock is_unlocked = true',
    ],
  })
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error('[Phase0 Track B] FAIL', message)
  process.exitCode = 1
})
