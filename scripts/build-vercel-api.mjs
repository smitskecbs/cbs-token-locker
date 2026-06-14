import * as esbuild from 'esbuild'
import { unlinkSync } from 'node:fs'

const routes = [
  ['api/v1/program.ts', 'api/v1/program.js'],
  ['api/v1/locks/index.ts', 'api/v1/locks/index.js'],
  ['api/v1/locks/[lockAccount].ts', 'api/v1/locks/[lockAccount].js'],
]

for (const [entry, outfile] of routes) {
  await esbuild.build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    packages: 'external',
    logLevel: 'info',
  })

  if (process.env.VERCEL === '1') {
    unlinkSync(entry)
  }
}

console.log('Bundled Vercel API routes:', routes.map(([, outfile]) => outfile).join(', '))
