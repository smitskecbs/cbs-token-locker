import type { LockRecord } from '../types/lock'
import { formatDateTime, formatTokenType } from './format'
import { formatLockAmountDisplay } from './lockDisplay'

function formatGeneratedTimestamp(date = new Date()): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'full',
    timeStyle: 'long',
  }).format(date)
}

export function buildLockCertificateText(
  lock: LockRecord,
  mintDecimals: number | null,
  generatedAt = new Date(),
): string {
  const amount = formatLockAmountDisplay(lock, mintDecimals)
  const verificationLabel = lock.onChainVerified ? 'Verified On-Chain' : 'Not verified'

  return [
    'CBS Token Locker',
    '================',
    '',
    verificationLabel,
    '',
    `Project name: ${lock.projectName}`,
    `Token type: ${formatTokenType(lock.tokenType)}`,
    `Amount: ${amount.human}`,
    `Raw amount: ${amount.raw}`,
    `Lock account: ${lock.lockAccount}`,
    `Vault account: ${lock.vault}`,
    `Token mint: ${lock.mint}`,
    `Owner: ${lock.owner}`,
    `Unlock date: ${formatDateTime(lock.unlockAt)}`,
    `Program ID: ${lock.programId}`,
    '',
    `Generated: ${formatGeneratedTimestamp(generatedAt)}`,
  ].join('\n')
}

export function buildLockCertificateHtml(
  lock: LockRecord,
  mintDecimals: number | null,
  generatedAt = new Date(),
): string {
  const amount = formatLockAmountDisplay(lock, mintDecimals)
  const verificationLabel = lock.onChainVerified ? 'Verified On-Chain' : 'Not verified'
  const rows = [
    ['Project name', lock.projectName],
    ['Token type', formatTokenType(lock.tokenType)],
    ['Amount', amount.human],
    ['Raw amount', amount.raw],
    ['Lock account', lock.lockAccount],
    ['Vault account', lock.vault],
    ['Token mint', lock.mint],
    ['Owner', lock.owner],
    ['Unlock date', formatDateTime(lock.unlockAt)],
    ['Program ID', lock.programId],
    ['Generated', formatGeneratedTimestamp(generatedAt)],
  ]

  const factRows = rows
    .map(
      ([label, value]) => `
        <tr>
          <th>${escapeCertificateHtml(label)}</th>
          <td>${escapeCertificateHtml(value)}</td>
        </tr>
      `,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>CBS Token Locker Certificate</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; margin: 40px; color: #1a1a1a; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    .eyebrow { text-transform: uppercase; letter-spacing: 0.12em; font-size: 12px; color: #666; }
    .badge { display: inline-block; margin: 16px 0 24px; padding: 6px 12px; border: 1px solid #d86f00; border-radius: 999px; font-size: 12px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 10px 0; border-bottom: 1px solid #e5e5e5; vertical-align: top; }
    th { width: 180px; color: #666; font-weight: 600; }
    td { font-family: Consolas, "Courier New", monospace; word-break: break-all; }
  </style>
</head>
<body>
  <p class="eyebrow">CBS Token Locker</p>
  <h1>${escapeCertificateHtml(lock.projectName)}</h1>
  <p class="badge">${escapeCertificateHtml(verificationLabel)}</p>
  <table>${factRows}</table>
</body>
</html>`
}

function escapeCertificateHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function downloadBlob(content: string, mimeType: string, filename: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function buildCertificateFilename(lock: LockRecord, extension: string): string {
  const shortId = lock.lockAccount.slice(0, 8)
  const safeProject = lock.projectName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)

  const suffix = safeProject ? `${safeProject}-` : ''
  return `cbs-lock-${suffix}${shortId}.${extension}`
}

export function downloadLockCertificate(
  lock: LockRecord,
  mintDecimals: number | null,
  format: 'txt' | 'html' = 'html',
): void {
  const generatedAt = new Date()

  if (format === 'txt') {
    downloadBlob(
      buildLockCertificateText(lock, mintDecimals, generatedAt),
      'text/plain;charset=utf-8',
      buildCertificateFilename(lock, 'txt'),
    )
    return
  }

  downloadBlob(
    buildLockCertificateHtml(lock, mintDecimals, generatedAt),
    'text/html;charset=utf-8',
    buildCertificateFilename(lock, 'html'),
  )
}
