import { address, assertIsAddress, fetchEncodedAccount, type Address } from '@solana/kit'
import { fetchMaybeMint, fetchMaybeToken, findAssociatedTokenPda } from '@solana-program/token'

import { OnChainLockerError } from './client'
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from './programId'
import { getSolanaRpc } from './rpc'

export async function resolveTokenProgramForMint(mintAddress: string): Promise<Address> {
  try {
    assertIsAddress(mintAddress)
  } catch {
    throw new OnChainLockerError('Invalid mint address.')
  }

  const rpc = getSolanaRpc()
  const mint = address(mintAddress)
  const encodedMint = await fetchEncodedAccount(rpc, mint)

  if (!encodedMint.exists) {
    throw new OnChainLockerError('Invalid mint address or mint account not found on this cluster.')
  }

  const mintOwner = String(encodedMint.programAddress)

  if (mintOwner === String(TOKEN_PROGRAM_ID)) {
    return TOKEN_PROGRAM_ID
  }

  if (mintOwner === String(TOKEN_2022_PROGRAM_ID)) {
    return TOKEN_2022_PROGRAM_ID
  }

  throw new OnChainLockerError('Unsupported token program for this mint.')
}

export type OwnerTokenBalanceFetchResult =
  | {
      kind: 'success'
      rawAmount: bigint
      decimals: number
    }
  | {
      kind: 'mint_not_found'
    }
  | {
      kind: 'load_failed'
    }

export async function fetchOwnerTokenBalance(input: {
  ownerAddress: string
  mintAddress: string
}): Promise<OwnerTokenBalanceFetchResult> {
  try {
    assertIsAddress(input.ownerAddress)
    assertIsAddress(input.mintAddress)
  } catch {
    return { kind: 'mint_not_found' }
  }

  try {
    const rpc = getSolanaRpc()
    const owner = address(input.ownerAddress)
    const mint = address(input.mintAddress)
    const mintAccount = await fetchMaybeMint(rpc, mint)

    if (!mintAccount.exists) {
      return { kind: 'mint_not_found' }
    }

    const [ownerTokenAccount] = await findAssociatedTokenPda({
      owner,
      mint,
      tokenProgram: TOKEN_PROGRAM_ID,
    })

    const tokenAccount = await fetchMaybeToken(rpc, ownerTokenAccount)
    const rawAmount = tokenAccount.exists ? tokenAccount.data.amount : 0n

    return {
      kind: 'success',
      rawAmount,
      decimals: mintAccount.data.decimals,
    }
  } catch {
    return { kind: 'load_failed' }
  }
}

export async function validateOwnerTokenBalance(input: {
  ownerAddress: string
  mintAddress: string
  amount: string
}): Promise<{ rawAmount: bigint; decimals: number; tokenProgram: Address }> {
  try {
    assertIsAddress(input.ownerAddress)
    assertIsAddress(input.mintAddress)
  } catch {
    throw new OnChainLockerError('Invalid mint address.')
  }

  const rpc = getSolanaRpc()
  const owner = address(input.ownerAddress)
  const mint = address(input.mintAddress)
  const tokenProgram = await resolveTokenProgramForMint(input.mintAddress)
  const mintAccount = await fetchMaybeMint(rpc, mint)

  if (!mintAccount.exists) {
    throw new OnChainLockerError('Invalid mint address or mint account not found on this cluster.')
  }

  const rawAmountText = input.amount.replaceAll(',', '').trim()
  const numericAmount = Number(rawAmountText)

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new OnChainLockerError('Amount must be greater than zero.')
  }

  const rawAmount = BigInt(Math.trunc(numericAmount * 10 ** mintAccount.data.decimals))

  const [ownerTokenAccount] = await findAssociatedTokenPda({
    owner,
    mint,
    tokenProgram,
  })

  const tokenAccount = await fetchMaybeToken(rpc, ownerTokenAccount)

  if (!tokenAccount.exists) {
    throw new OnChainLockerError(
      'Token account not found for this wallet and mint on the selected cluster.',
    )
  }

  if (tokenAccount.data.amount < rawAmount) {
    throw new OnChainLockerError('Insufficient token balance for the requested lock amount.')
  }

  return {
    rawAmount,
    decimals: mintAccount.data.decimals,
    tokenProgram,
  }
}
