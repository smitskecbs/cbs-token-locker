import { getSelectedNetwork } from '../solana/cluster'

const PUBLIC_VERIFY_API_BASE =
  import.meta.env.VITE_CBS_LOCKER_VERIFY_API_BASE?.trim() ||
  'https://cbs-locker-api.vercel.app/api/v1'

export type PublicLockVerificationResponse = {
  cluster?: string
  programId?: string
  lockAccount?: string
  verified: boolean
  verification?: {
    status?: string
    reason?: string
    checks?: Record<string, boolean>
  }
  verifiedAt?: string
}

export function getLockVerifyApiUrl(
  lockAccount: string,
  cluster = getSelectedNetwork(),
): string {
  const params = new URLSearchParams()
  params.set('cluster', cluster)
  const query = params.toString()

  return `${PUBLIC_VERIFY_API_BASE}/verify/lock/${encodeURIComponent(lockAccount)}?${query}`
}

export async function verifyLockFromPublicApi(
  lockAccount: string,
  cluster = getSelectedNetwork(),
): Promise<PublicLockVerificationResponse> {
  const url = getLockVerifyApiUrl(lockAccount, cluster)
  const response = await fetch(url)

  if (!response.ok) {
    let message = `CBS Locker API verification failed (${response.status}).`

    try {
      const body = (await response.json()) as { error?: string; verification?: { reason?: string } }
      message = body.verification?.reason ?? body.error ?? message
    } catch {
      // Keep default message when response body is not JSON.
    }

    return {
      lockAccount,
      verified: false,
      verification: {
        status: 'failed',
        reason: message,
      },
    }
  }

  return (await response.json()) as PublicLockVerificationResponse
}
