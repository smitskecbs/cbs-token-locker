import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleApiRequest } from './requestHandler.ts'

function createVercelResponseSink(response: VercelResponse) {
  let statusCode = 200

  return {
    writeHead(status: number, headers: Record<string, string>): void {
      statusCode = status

      for (const [name, value] of Object.entries(headers)) {
        response.setHeader(name, value)
      }

      response.status(status)
    },
    end(body: string): void {
      if (statusCode === 204) {
        response.end()
        return
      }

      response.send(body)
    },
  }
}

function resolveRequestUrl(request: VercelRequest): URL {
  const protocol = String(request.headers['x-forwarded-proto'] ?? 'https')
  const host = request.headers.host ?? 'localhost'
  const rawUrl = request.url ?? '/'

  return new URL(rawUrl, `${protocol}://${host}`)
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
): Promise<void> {
  const url = resolveRequestUrl(request)
  const sink = createVercelResponseSink(response)

  try {
    await handleApiRequest(request.method, url, sink)
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      'body' in error &&
      typeof (error as { status: unknown }).status === 'number'
    ) {
      const apiError = error as { status: number; body: unknown }
      sink.writeHead(apiError.status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      })
      sink.end(JSON.stringify(apiError.body))
      return
    }

    const message = error instanceof Error ? error.message : 'Internal server error.'
    sink.writeHead(500, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    })
    sink.end(JSON.stringify({ error: message }))
  }
}
