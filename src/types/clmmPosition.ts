export type ClmmTokenProgramKind = 'legacy-spl' | 'token-2022'

export type ClmmPositionCandidate = {
  mint: string
  tokenProgram: ClmmTokenProgramKind
  tokenProgramId: string
}

export type ClmmPositionScanResult =
  | {
      kind: 'success'
      positions: ClmmPositionCandidate[]
    }
  | {
      kind: 'error'
      message: string
    }
