import type { SimulationDiagnostics } from '../solana/simulationDiagnostics'
import type { UnlockTransferDiagnostics } from '../solana/unlockVerification'

type DebugListener = () => void

export type DebugState = {
  lastTransactionSignature: string | null
  lastLockPda: string | null
  lastVaultPda: string | null
  lastError: string | null
  lastSimulationDiagnostics: SimulationDiagnostics | null
  lastUnlockDiagnostics: UnlockTransferDiagnostics | null
}

let debugState: DebugState = {
  lastTransactionSignature: null,
  lastLockPda: null,
  lastVaultPda: null,
  lastError: null,
  lastSimulationDiagnostics: null,
  lastUnlockDiagnostics: null,
}

const listeners = new Set<DebugListener>()

function notifyListeners(): void {
  for (const listener of listeners) {
    listener()
  }
}

export function getDebugState(): DebugState {
  return { ...debugState }
}

export function setLastTransactionSignature(signature: string | null): void {
  debugState = {
    ...debugState,
    lastTransactionSignature: signature,
  }
  notifyListeners()
}

export function setLastLockPdas(lockPda: string | null, vaultPda: string | null): void {
  debugState = {
    ...debugState,
    lastLockPda: lockPda,
    lastVaultPda: vaultPda,
  }
  notifyListeners()
}

export function setLastError(message: string | null): void {
  debugState = {
    ...debugState,
    lastError: message,
  }
  notifyListeners()
}

export function setLastSimulationDiagnostics(diagnostics: SimulationDiagnostics | null): void {
  debugState = {
    ...debugState,
    lastSimulationDiagnostics: diagnostics,
  }
  notifyListeners()
}

export function setLastUnlockDiagnostics(diagnostics: UnlockTransferDiagnostics | null): void {
  debugState = {
    ...debugState,
    lastUnlockDiagnostics: diagnostics,
  }
  notifyListeners()
}

export function clearSimulationDiagnostics(): void {
  setLastSimulationDiagnostics(null)
}

export function subscribeToDebugState(listener: DebugListener): () => void {
  listeners.add(listener)
  listener()

  return () => {
    listeners.delete(listener)
  }
}

export function isDevelopmentMode(): boolean {
  return Boolean(import.meta.env.DEV)
}
