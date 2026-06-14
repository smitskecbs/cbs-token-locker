import { getDebugState, isDebugPanelVisible } from '../state/debugStore'

import { getProgramStatus } from '../state/programStore'
import { getRpcCallStats } from '../state/rpcCallTracker'

import {
  getSelectedClusterLabel,
  getSelectedNetwork,
  getSelectedRpcConfiguration,
  getSelectedRpcDisplayUrl,
  getSelectedRpcSourceLabel,
} from '../solana/cluster'

import { CBS_LOCKER_PROGRAM_ID } from '../solana/programId'

import { getWalletConnectionState } from '../wallet'

import { escapeHtml } from '../utils/html'

import { formatWalletAddress } from '../utils/format'

import { formatSimulationErrorSummary, renderSimulationDebugBlock } from './simulationDebug'

export function renderDebugPanel(): string {
  if (!isDebugPanelVisible()) {
    return ''
  }

  const debug = getDebugState()
  const programStatus = getProgramStatus()
  const rpcStats = getRpcCallStats()
  const walletState = getWalletConnectionState()
  const walletAddress = walletState.address ?? 'Not connected'
  const rpcConfig = getSelectedRpcConfiguration()
  const diagnostics = debug.lastSimulationDiagnostics



  const topCallersBlock =
    rpcStats.topCallers.length === 0
      ? '<dd>None</dd>'
      : `
        <dd>
          <ol class="rpc-caller-list">
            ${rpcStats.topCallers
              .map(
                (caller) =>
                  `<li><span class="mono">${escapeHtml(caller.source)}</span> (${caller.count})</li>`,
              )
              .join('')}
          </ol>
        </dd>
      `

  const contextBlock = diagnostics?.transactionContext

    ? `

      <div class="debug-item">

        <dt>Lock PDA</dt>

        <dd class="mono">${escapeHtml(diagnostics.transactionContext.lockPda)}</dd>

      </div>

      <div class="debug-item">

        <dt>Vault PDA</dt>

        <dd class="mono">${escapeHtml(diagnostics.transactionContext.vaultPda)}</dd>

      </div>

      <div class="debug-item">

        <dt>Owner Token Account</dt>

        <dd class="mono">${escapeHtml(diagnostics.transactionContext.ownerTokenAccount)}</dd>

      </div>

      <div class="debug-item">

        <dt>Owner Wallet</dt>

        <dd class="mono">${escapeHtml(diagnostics.transactionContext.ownerWallet)}</dd>

      </div>

      <div class="debug-item">

        <dt>Mint</dt>

        <dd class="mono">${escapeHtml(diagnostics.transactionContext.mint)}</dd>

      </div>

      <div class="debug-item">

        <dt>Unlock Timestamp</dt>

        <dd class="mono">${escapeHtml(diagnostics.transactionContext.unlockTimestamp)}</dd>

      </div>

      <div class="debug-item">

        <dt>Amount (raw)</dt>

        <dd class="mono">${escapeHtml(diagnostics.transactionContext.amount)}</dd>

      </div>

      <div class="debug-item">

        <dt>Lock Seed</dt>

        <dd class="mono">${escapeHtml(diagnostics.transactionContext.lockSeed)}</dd>

      </div>

    `

    : ''



  const simulationBlock = diagnostics

    ? `

      <div class="debug-item">

        <dt>Simulation Source</dt>

        <dd>${escapeHtml(diagnostics.source)}</dd>

      </div>

      <div class="debug-item">

        <dt>Instruction Index</dt>

        <dd>${diagnostics.instructionIndex ?? 'n/a'}</dd>

      </div>

      <div class="debug-item">

        <dt>Anchor Error</dt>

        <dd>${escapeHtml(diagnostics.anchorErrorName ?? 'n/a')} (${diagnostics.anchorErrorCode ?? 'n/a'})</dd>

      </div>

      <div class="debug-item">

        <dt>Account Validation</dt>

        <dd>${escapeHtml(diagnostics.accountValidationFailure ?? 'n/a')}</dd>

      </div>

      <div class="debug-item">

        <dt>Simulation Summary</dt>

        <dd>${escapeHtml(formatSimulationErrorSummary(diagnostics))}</dd>

      </div>

      ${renderSimulationDebugBlock(diagnostics, { idPrefix: 'debugPanel', showCopyButton: true })}

    `

    : ''



  return `

    <section class="advanced-details-section debug-panel-section" id="debug-panel">

      <details class="advanced-details debug-panel-details">

        <summary class="advanced-details__summary">Development Debug Panel</summary>

        <div class="advanced-details__content">

          <div class="panel-card debug-panel__card">

        <dl class="debug-list">

          <div class="debug-item">

            <dt>Selected Cluster</dt>

            <dd>${escapeHtml(getSelectedClusterLabel())} (${escapeHtml(getSelectedNetwork())})</dd>

          </div>

          <div class="debug-item">

            <dt>RPC Source</dt>

            <dd>${escapeHtml(getSelectedRpcSourceLabel())}</dd>

          </div>

          <div class="debug-item">

            <dt>RPC URL</dt>

            <dd class="mono">${escapeHtml(getSelectedRpcDisplayUrl())}</dd>

          </div>

          <div class="debug-item">

            <dt>API Key Loaded</dt>

            <dd>${rpcConfig.heliusApiKeyLoaded ? 'Yes' : 'No'}</dd>

          </div>

          <div class="debug-item">

            <dt>Program ID</dt>

            <dd class="mono">${escapeHtml(CBS_LOCKER_PROGRAM_ID)}</dd>

          </div>

          <div class="debug-item">

            <dt>Wallet Address</dt>

            <dd class="mono">${escapeHtml(formatWalletAddress(walletAddress, 8))}</dd>

          </div>

          <div class="debug-item">

            <dt>Program Deployed</dt>

            <dd>${programStatus.loading ? 'Checking…' : !programStatus.statusKnown ? 'Unknown' : programStatus.deployed ? 'Yes' : 'No'}</dd>

          </div>

          <div class="debug-item">

            <dt>RPC calls last 30s</dt>

            <dd>${rpcStats.countLast30s}</dd>

          </div>

          <div class="debug-item">

            <dt>Top callers</dt>

            ${topCallersBlock}

          </div>

          <div class="debug-item">

            <dt>Last Lock PDA</dt>

            <dd class="mono">${escapeHtml(debug.lastLockPda ?? 'None')}</dd>

          </div>

          <div class="debug-item">

            <dt>Last Vault PDA</dt>

            <dd class="mono">${escapeHtml(debug.lastVaultPda ?? 'None')}</dd>

          </div>

          <div class="debug-item">

            <dt>Last Transaction Signature</dt>

            <dd class="mono">${escapeHtml(debug.lastTransactionSignature ?? 'None')}</dd>

          </div>

          <div class="debug-item">

            <dt>Last Error</dt>

            <dd>${escapeHtml(debug.lastError ?? 'None')}</dd>

          </div>

          ${
            debug.lastUnlockDiagnostics
              ? `
                <div class="debug-item">
                  <dt>Last Unlock Vault ATA</dt>
                  <dd class="mono">${escapeHtml(debug.lastUnlockDiagnostics.vaultTokenAccount)}</dd>
                </div>
                <div class="debug-item">
                  <dt>Last Unlock Owner ATA</dt>
                  <dd class="mono">${escapeHtml(debug.lastUnlockDiagnostics.ownerTokenAccount)}</dd>
                </div>
                <div class="debug-item">
                  <dt>Last Unlock Amount</dt>
                  <dd class="mono">${escapeHtml(debug.lastUnlockDiagnostics.transferredAmount)}</dd>
                </div>
                <div class="debug-item">
                  <dt>Unlock Transfer Verified</dt>
                  <dd>${debug.lastUnlockDiagnostics.transferVerified ? 'Yes' : 'No'}</dd>
                </div>
                <div class="debug-item">
                  <dt>Vault Before / After</dt>
                  <dd class="mono">${escapeHtml(debug.lastUnlockDiagnostics.before.vault.amount)} → ${escapeHtml(debug.lastUnlockDiagnostics.after.vault.amount)}</dd>
                </div>
                <div class="debug-item">
                  <dt>Owner ATA Before / After</dt>
                  <dd class="mono">${escapeHtml(debug.lastUnlockDiagnostics.before.ownerAta.amount)} → ${escapeHtml(debug.lastUnlockDiagnostics.after.ownerAta.amount)}</dd>
                </div>
              `
              : ''
          }

          ${contextBlock}

          ${simulationBlock}

        </dl>

        <button
          type="button"
          class="secondary-btn"
          id="debugOpenLastLockBtn"
          ${debug.lastLockPda ? '' : 'disabled'}
        >
          Open Last Created Lock
        </button>

      </div>

        </div>

      </details>

    </section>

  `

}


