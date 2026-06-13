import { refreshProgramStatus } from '../state/programStore'
import { logRpcConfiguration } from '../solana/config'
import { getSelectedNetwork } from '../solana/cluster'

export async function initializeAppState(): Promise<void> {
  const network = getSelectedNetwork()
  logRpcConfiguration(network)
  await refreshProgramStatus(network)
}
