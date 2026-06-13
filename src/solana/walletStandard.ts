import { getWallets } from '@wallet-standard/app'

export function getWalletStandardWallets() {
  const walletsApi = getWallets()

  return walletsApi.get()
}
