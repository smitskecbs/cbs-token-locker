import { address, assertIsAddress, type Address } from '@solana/kit'
import type { JsonParsedTokenAccount } from '@solana/rpc-parsed-types'

import type {
  ClmmPositionCandidate,
  ClmmPositionScanResult,
  ClmmTokenProgramKind,
} from '../types/clmmPosition'
import { withRpcCallSource } from '../state/rpcCallTracker'

import { getSelectedNetwork } from './cluster'
import type { SolanaNetwork } from './config'
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from './programId'
import { filterRaydiumClmmPositionMints } from './raydiumClmm'
import { getSolanaRpc } from './rpc'

type NftTokenHolding = {
  mint: Address
  tokenProgram: ClmmTokenProgramKind
  tokenProgramId: Address
}

type JsonParsedTokenAccountRow = {
  pubkey: Address
  account: {
    data: {
      parsed: {
        type: string
        info: JsonParsedTokenAccount
      }
    }
  }
}

function isJsonParsedTokenAccountRow(value: unknown): value is JsonParsedTokenAccountRow {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const row = value as {
    pubkey?: unknown
    account?: { data?: { parsed?: { type?: unknown; info?: unknown } } }
  }

  return (
    typeof row.pubkey === 'string' &&
    typeof row.account?.data?.parsed?.type === 'string' &&
    typeof row.account?.data?.parsed?.info === 'object' &&
    row.account.data.parsed.info !== null
  )
}

function parseNftHoldingsFromTokenAccounts(
  rows: readonly unknown[],
  tokenProgramId: Address,
  tokenProgram: ClmmTokenProgramKind,
): NftTokenHolding[] {
  const holdings: NftTokenHolding[] = []

  for (const row of rows) {
    if (!isJsonParsedTokenAccountRow(row)) {
      continue
    }

    const parsed = row.account.data.parsed

    if (parsed.type !== 'account') {
      continue
    }

    const { tokenAmount, mint } = parsed.info

    if (!isNftTokenAmount(tokenAmount.amount, tokenAmount.decimals)) {
      continue
    }

    holdings.push({
      mint: address(mint),
      tokenProgram,
      tokenProgramId,
    })
  }

  return holdings
}

function isNftTokenAmount(amount: string, decimals: number): boolean {
  return decimals === 0 && amount === '1'
}

async function fetchNftHoldingsForProgram(input: {
  owner: Address
  network: SolanaNetwork
  tokenProgramId: Address
  tokenProgram: ClmmTokenProgramKind
}): Promise<NftTokenHolding[]> {
  const rpc = getSolanaRpc(input.network)
  const response = await rpc
    .getTokenAccountsByOwner(
      input.owner,
      { programId: input.tokenProgramId },
      { encoding: 'jsonParsed', commitment: 'confirmed' },
    )
    .send()

  return parseNftHoldingsFromTokenAccounts(
    response.value,
    input.tokenProgramId,
    input.tokenProgram,
  )
}

function dedupeHoldingsByMint(holdings: readonly NftTokenHolding[]): NftTokenHolding[] {
  const byMint = new Map<string, NftTokenHolding>()

  for (const holding of holdings) {
    const key = holding.mint

    if (!byMint.has(key)) {
      byMint.set(key, holding)
    }
  }

  return [...byMint.values()]
}

export async function scanWalletClmmPositions(input: {
  ownerAddress: string
  network?: SolanaNetwork
}): Promise<ClmmPositionScanResult> {
  try {
    assertIsAddress(input.ownerAddress)
  } catch {
    return {
      kind: 'error',
      message: 'Connect a valid wallet before scanning for CLMM positions.',
    }
  }

  const network = input.network ?? getSelectedNetwork()
  const owner = address(input.ownerAddress)

  return withRpcCallSource('clmm:scan-wallet', async () => {
    try {
      const [legacyHoldings, token2022Holdings] = await Promise.all([
        fetchNftHoldingsForProgram({
          owner,
          network,
          tokenProgramId: TOKEN_PROGRAM_ID,
          tokenProgram: 'legacy-spl',
        }),
        fetchNftHoldingsForProgram({
          owner,
          network,
          tokenProgramId: TOKEN_2022_PROGRAM_ID,
          tokenProgram: 'token-2022',
        }),
      ])

      const nftCandidates = dedupeHoldingsByMint([...legacyHoldings, ...token2022Holdings])

      if (nftCandidates.length === 0) {
        return {
          kind: 'success',
          positions: [],
        }
      }

      const validMints = await filterRaydiumClmmPositionMints(
        nftCandidates.map((candidate) => candidate.mint),
        network,
      )

      const positions: ClmmPositionCandidate[] = nftCandidates
        .filter((candidate) => validMints.has(candidate.mint))
        .map((candidate) => ({
          mint: candidate.mint,
          tokenProgram: candidate.tokenProgram,
          tokenProgramId: candidate.tokenProgramId,
        }))
        .sort((left, right) => left.mint.localeCompare(right.mint))

      return {
        kind: 'success',
        positions,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'CLMM wallet scan failed.'

      return {
        kind: 'error',
        message,
      }
    }
  })
}
