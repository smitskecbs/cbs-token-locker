export type TokenType = 'spl' | 'lp' | 'clmm' | 'unknown'

export type LockRecord = {
  lockAccount: string
  owner: string
  mint: string
  vault: string
  amount: string
  unlockAt: string
  createdAt: string
  lockSeed: string
  tokenType: TokenType
  isUnlocked: boolean
  tokenProgram: string
  projectName: string
  programId: string
  onChainVerified: boolean
  createSignature?: string
}

export type OnChainVerification = {
  verified: boolean
  reason: string
}

export type LockSearchField = 'all' | 'lockId' | 'wallet' | 'mint' | 'project'
