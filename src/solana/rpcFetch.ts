import { isSolanaError } from '@solana/kit'

export const RPC_MIN_INTERVAL_MS = 200
export const RPC_MAX_RETRIES = 4
export const RPC_RETRY_BASE_MS = 1_000

let lastRequestAt = 0
let requestChain: Promise<void> = Promise.resolve()

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms)
  })
}

async function waitForRpcSlot(): Promise<void> {
  const scheduled = requestChain.then(async () => {
    const now = Date.now()
    const delayMs = Math.max(0, RPC_MIN_INTERVAL_MS - (now - lastRequestAt))

    if (delayMs > 0) {
      await sleep(delayMs)
    }

    lastRequestAt = Date.now()
  })

  requestChain = scheduled.catch(() => undefined)
  await scheduled
}

export function isRpcRateLimitError(error: unknown): boolean {
  if (isSolanaError(error) && error.context) {
    const context = error.context as { statusCode?: number; message?: string }
    if (context.statusCode === 429) {
      return true
    }

    const message = String(context.message ?? error.message).toLowerCase()

    if (message.includes('429') || message.includes('too many requests') || message.includes('rate limit')) {
      return true
    }
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return (
      message.includes('429') ||
      message.includes('too many requests') ||
      message.includes('rate limit') ||
      message.includes('rate-limiting')
    )
  }

  return false
}

function isRateLimitedResponse(response: Response): boolean {
  return response.status === 429
}

export function createThrottledRpcFetch(): typeof fetch {
  return async (input, init) => {
    let lastResponse: Response | null = null

    for (let attempt = 0; attempt <= RPC_MAX_RETRIES; attempt += 1) {
      await waitForRpcSlot()

      const response = await fetch(input, init)
      lastResponse = response

      if (!isRateLimitedResponse(response)) {
        return response
      }

      if (attempt < RPC_MAX_RETRIES) {
        const delayMs = RPC_RETRY_BASE_MS * 2 ** attempt
        await sleep(delayMs)
      }
    }

    return lastResponse!
  }
}
