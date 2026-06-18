import type { CreateLockInput, LockRecord, TokenType } from './lock'

export type LockMode = 'single' | 'split'

export type SplitLockInterval = 'monthly' | 'yearly'

export type SplitLockInput = {
  projectName: string
  projectDescription: string
  tokenMint: string
  tokenType: TokenType
  totalAmount: string
  unlockCount: number
  interval: SplitLockInterval
  firstUnlockDate: string
  firstUnlockTime: string
  lockerWallet: string
}

export type SplitLockTranche = {
  index: number
  amount: string
  unlockDate: string
  unlockTime: string
  unlockAt: string
  percentLabel: string
  projectName: string
}

export type SplitLockPreview = {
  mode: 'split'
  projectName: string
  tokenMint: string
  tokenType: TokenType
  totalAmount: string
  lockerWallet: string
  unlockCount: number
  interval: SplitLockInterval
  tranches: SplitLockTranche[]
}

export type SplitLockTrancheResult = {
  index: number
  status: 'pending' | 'active' | 'success' | 'failed' | 'skipped'
  lockAccount?: string
  signature?: string
  error?: string
}

export type SplitLockBatchResult = {
  completed: LockRecord[]
  results: SplitLockTrancheResult[]
  failedAt: number | null
  errorMessage: string | null
}

export type { CreateLockInput }
