import { fetchEncodedAccount } from '@solana/kit'

import type { SolanaNetwork } from './config'
import { CBS_LOCKER_PROGRAM_ID } from './programId'
import { getSolanaRpc } from './rpc'

export type ProgramDeploymentStatus = {
  cluster: SolanaNetwork
  deployed: boolean
  statusKnown: boolean
  checkedAt: string | null
  loading: boolean
  error: string | null
}

export function getProgramStatusDisplayMessage(
  status: ProgramDeploymentStatus,
  clusterLabel: string,
): string {
  if (status.loading) {
    return 'Checking CBS Locker Program status…'
  }

  if (!status.statusKnown) {
    return status.error ?? 'Unable to verify program status.'
  }

  if (status.deployed) {
    return `CBS Locker Program is deployed on ${clusterLabel}.`
  }

  return `CBS Locker Program is not deployed on ${clusterLabel} yet.`
}

export async function checkProgramDeployed(
  cluster: SolanaNetwork,
): Promise<ProgramDeploymentStatus> {
  const rpc = getSolanaRpc(cluster)
  const account = await fetchEncodedAccount(rpc, CBS_LOCKER_PROGRAM_ID)

  return {
    cluster,
    deployed: account.exists && account.executable,
    statusKnown: true,
    checkedAt: new Date().toISOString(),
    loading: false,
    error: null,
  }
}
