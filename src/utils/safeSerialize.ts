/**
 * Converts values for debug logging, API payloads, and error messages.
 * BigInt is stringified; on-chain u64/i64 encoding is unchanged elsewhere.
 */
export function serializeForDebug(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value
  }

  if (typeof value === 'bigint') {
    return value.toString()
  }

  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
    return value
  }

  if (value instanceof Uint8Array) {
    return `Uint8Array(${value.length})`
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    }
  }

  if (Array.isArray(value)) {
    return value.map((entry) => serializeForDebug(entry))
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, serializeForDebug(entry)]),
    )
  }

  return String(value)
}

export function safeJsonStringify(value: unknown, space?: number): string {
  return JSON.stringify(serializeForDebug(value), null, space)
}

export function isBigIntSerializationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()

  return message.includes('serialize a bigint') || message.includes('do not know how to serialize a bigint')
}
