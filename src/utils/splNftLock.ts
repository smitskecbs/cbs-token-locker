/** Legacy SPL NFT: decimals 0 and exactly one token in the wallet ATA. */
export function isLegacySplNftHolding(decimals: number, rawAmount: bigint): boolean {
  return decimals === 0 && rawAmount === 1n
}

let splNftLockDetected = false

export function isSplNftLockDetected(): boolean {
  return splNftLockDetected
}

export function setSplNftLockDetected(detected: boolean): void {
  splNftLockDetected = detected
}

export function clearSplNftLockDetected(): void {
  splNftLockDetected = false
}
