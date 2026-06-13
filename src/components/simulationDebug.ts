import type { SimulationDiagnostics } from '../solana/simulationDiagnostics'
import { escapeHtml } from '../utils/html'

export function formatSimulationErrorSummary(diagnostics: SimulationDiagnostics): string {
  const lines: string[] = [diagnostics.summary]

  if (diagnostics.instructionIndex !== null) {
    lines.push(`Instruction index: ${diagnostics.instructionIndex}`)
  }

  if (diagnostics.anchorErrorName) {
    lines.push(
      `Anchor error: ${diagnostics.anchorErrorName} (${diagnostics.anchorErrorCode ?? 'unknown'})`,
    )
  }

  if (diagnostics.anchorErrorMessage) {
    lines.push(diagnostics.anchorErrorMessage)
  }

  if (diagnostics.accountValidationFailure) {
    lines.push(`Account validation: ${diagnostics.accountValidationFailure}`)
  }

  if (diagnostics.customProgramError !== null && !diagnostics.anchorErrorName) {
    lines.push(`Custom program error: ${diagnostics.customProgramError}`)
  }

  const failedLog = diagnostics.programLogs.find((line) => {
    return (
      line.includes('failed') ||
      line.includes('Error') ||
      line.includes('AnchorError') ||
      line.includes('custom program error')
    )
  })

  if (failedLog) {
    lines.push(failedLog)
  }

  return lines.join('\n')
}

export function renderSimulationDebugBlock(
  diagnostics: SimulationDiagnostics | null,
  options: { idPrefix: string; showCopyButton: boolean },
): string {
  if (!diagnostics) {
    return ''
  }

  const summary = formatSimulationErrorSummary(diagnostics)
  const copyButton = options.showCopyButton
    ? `<button type="button" class="secondary-btn" id="${options.idPrefix}CopyDebugBtn">Copy Debug Output</button>`
    : ''

  return `
    <div class="simulation-debug" id="${options.idPrefix}SimulationDebug" data-debug-text-id="${options.idPrefix}DebugText">
      <p class="simulation-debug__label">Simulation details</p>
      <pre class="mono simulation-debug__summary" id="${options.idPrefix}DebugSummary">${escapeHtml(summary)}</pre>
      <pre class="mono simulation-debug__pre" id="${options.idPrefix}DebugText">${escapeHtml(diagnostics.fullText)}</pre>
      ${copyButton}
    </div>
  `
}
