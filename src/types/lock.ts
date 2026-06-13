export type TokenType = 'spl' | 'lp'

export type LockStatus = 'active' | 'unlock_available' | 'unlocked'

export type OnChainVerification = {
  verified: boolean
  reason: string
}

/** Preview-only lock details before an on-chain transaction is submitted. */
export type PreviewLock = {
  mode: 'preview'
  projectName: string
  projectDescription: string
  tokenMint: string
  tokenType: TokenType
  amount: string
  lockerWallet: string
  unlockAt: string
}

/** Verified on-chain lock record read directly from Solana. */
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

export type CreateLockInput = {
  projectName: string
  projectDescription: string
  tokenMint: string
  tokenType: TokenType
  amount: string
  lockerWallet: string
  unlockDate: string
  unlockTime: string
}

export type LockSearchField =
  | 'all'
  | 'lockId'
  | 'wallet'
  | 'mint'
  | 'project'

export type MyLocksFilter = 'all' | 'active' | 'expired' | 'upcoming'
