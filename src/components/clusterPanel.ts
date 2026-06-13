import { getProgramStatus } from '../state/programStore'
import {
  getSelectedClusterLabel,
  getSelectedNetwork,
  getSelectedRpcDisplayUrl,
  getSelectedRpcSourceLabel,
} from '../solana/cluster'
import { getProgramStatusDisplayMessage } from '../solana/programStatus'
import { escapeHtml } from '../utils/html'

export function renderClusterPanel(): string {
  const network = getSelectedNetwork()
  const programStatus = getProgramStatus()

  const devnetSelected = network === 'devnet' ? ' selected' : ''
  const mainnetSelected = network === 'mainnet' ? ' selected' : ''

  const programMessage = getProgramStatusDisplayMessage(programStatus, getSelectedClusterLabel())

  const programClass = programStatus.loading
    ? 'program-status program-status--loading'
    : !programStatus.statusKnown
      ? 'program-status program-status--warning'
      : programStatus.deployed
        ? 'program-status program-status--ready'
        : 'program-status program-status--missing'

  const statusError =
    programStatus.error && programStatus.statusKnown
      ? `<p class="form-error" role="alert">${escapeHtml(programStatus.error)}</p>`
      : ''

  return `
    <section
      class="page-section cluster-panel"
      id="cluster"
      aria-labelledby="cluster-heading"
    >
      <h2 class="section-title" id="cluster-heading">Network</h2>
      <div class="panel-card">
        <p class="panel-lead">
          Select the Solana cluster used for on-chain lock creation and verification.
        </p>

        <label class="field">
          <span class="field-label">Cluster</span>
          <select class="field-input field-select" id="clusterSelect">
            <option value="devnet"${devnetSelected}>Devnet</option>
            <option value="mainnet"${mainnetSelected}>Mainnet</option>
          </select>
        </label>

        <p class="cluster-rpc-label">
          RPC Source: ${escapeHtml(getSelectedRpcSourceLabel())}
        </p>
        <p class="cluster-rpc-label mono">
          RPC URL: ${escapeHtml(getSelectedRpcDisplayUrl())}
        </p>

        <div class="${programClass}" id="programStatusBanner" role="status">
          ${escapeHtml(programMessage)}
        </div>

        ${statusError}

        <button type="button" class="secondary-btn" id="refreshProgramStatusBtn">
          Recheck Program Status
        </button>
      </div>
    </section>
  `
}
