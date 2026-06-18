import 'dotenv/config'

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'

import { logApiRpcConfiguration } from '../src/solana/config.ts'
import { CBS_LOCKER_PROGRAM_ID } from '../src/solana/programId.ts'
import { createNodeResponseSink, handleApiRequest } from '../serverless/requestHandler.ts'

const PORT = Number(process.env.LOCK_API_PORT || 8787)

async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)
  const sink = createNodeResponseSink(response)

  await handleApiRequest(request.method, url, sink)
}

createServer((request, response) => {
  void handleRequest(request, response).catch((error: unknown) => {
    const sink = createNodeResponseSink(response)

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
  })
}).listen(PORT, () => {
  logApiRpcConfiguration()
  console.log(`CBS Token Locker API listening on http://localhost:${PORT}`)
  console.log(`Program ID: ${CBS_LOCKER_PROGRAM_ID}`)
  console.log('API cluster param: cluster=devnet | cluster=mainnet (defaults to mainnet)')
})
