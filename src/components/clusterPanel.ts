import { getProgramStatus } from '../state/programStore'

import {

  getSelectedClusterLabel,

  getSelectedNetwork,

  getSelectedRpcDisplayUrl,

  getSelectedRpcSourceLabel,

} from '../solana/cluster'

import { getProgramStatusDisplayMessage } from '../solana/programStatus'

import { escapeHtml } from '../utils/html'



export function renderProgramStatusBanner(): string {

  const programStatus = getProgramStatus()

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

      ? `<p class="form-error wallet-bar__program-error" role="alert">${escapeHtml(programStatus.error)}</p>`

      : ''



  return `

    <div class="${programClass} wallet-bar__program-status" id="programStatusBanner" role="status">

      ${escapeHtml(programMessage)}

    </div>

    ${statusError}

  `

}



export function renderWalletNetworkSection(): string {
  const network = getSelectedNetwork()
  const devnetSelected = network === 'devnet' ? ' selected' : ''
  const mainnetSelected = network === 'mainnet' ? ' selected' : ''

  return `
    <select class="field-input field-select wallet-bar__network-select" id="clusterSelect" aria-label="Network">
      <option value="devnet"${devnetSelected}>Devnet</option>
      <option value="mainnet"${mainnetSelected}>Mainnet</option>
    </select>
  `
}



export function renderClusterAdvancedDetails(): string {
  return `
    <div class="technical-details__block cluster-panel cluster-panel--embedded" id="cluster-advanced">
      <h3 class="technical-details__heading">Network</h3>
      <div class="panel-card panel-card--compact">
        ${renderProgramStatusBanner()}
        <details class="technical-details technical-details--inline">
          <summary class="technical-details__summary technical-details__summary--compact">
            RPC connection details
          </summary>
          <div class="technical-details__content technical-details__content--compact">
            <p class="cluster-rpc-label">
              RPC Source: ${escapeHtml(getSelectedRpcSourceLabel())}
            </p>
            <p class="cluster-rpc-label mono">
              RPC URL: ${escapeHtml(getSelectedRpcDisplayUrl())}
            </p>
          </div>
        </details>
        <button type="button" class="secondary-btn" id="refreshProgramStatusBtn">
          Recheck Program Status
        </button>
      </div>
    </div>
  `
}



/** @deprecated Use renderWalletNetworkSection + renderClusterAdvancedDetails */

export function renderClusterPanel(options?: { embedded?: boolean }): string {

  if (options?.embedded) {

    return renderClusterAdvancedDetails()

  }



  return `

    <section

      class="page-section cluster-panel"

      id="cluster"

      aria-labelledby="cluster-heading"

    >

      <h2 class="section-title" id="cluster-heading">Network</h2>

      <div class="panel-card">

        ${renderWalletNetworkSection()}

        ${renderClusterAdvancedDetails()}

      </div>

    </section>

  `

}


