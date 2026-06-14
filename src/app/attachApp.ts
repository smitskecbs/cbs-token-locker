import {
  buildLockPreview,
  filterActiveWalletLocks,
  filterHistoryWalletLocks,
  filterSearchLocks,
  LockerValidationError,
  sortLocksNewestFirst,
} from '../locker'
import { getPublicLocksPath, navigate } from '../routes'
import { fetchWalletLocksFromApi, searchLocksFromApi } from '../services/lockApi'
import {
  getSelectedClusterLabel,
  getSelectedNetwork,
  setSelectedNetwork,
} from '../solana/cluster'
import type { SolanaNetwork } from '../solana/config'
import { logRpcConfiguration } from '../solana/config'
import { renderSimulationDebugBlock } from '../components/simulationDebug'
import { OnChainLockerError } from '../solana/client'
import { formatLockerError } from '../solana/errors'
import type { SimulationDiagnostics } from '../solana/simulationDiagnostics'
import { resetRpcCache } from '../solana/rpc'
import {
  LIVE_REFRESH_INTERVAL_MS,
  setLockCreationInProgress,
  shouldPauseBackgroundRpcRefresh,
} from '../state/rpcActivityStore'
import {
  setRpcActiveTab,
  subscribeToRpcCallTracker,
  withRpcCallSource,
} from '../state/rpcCallTracker'
import {
  clearSimulationDiagnostics,
  getDebugState,
  isDebugPanelVisible,
  setLastError,
  setLastLockPdas,
  setLastSimulationDiagnostics,
  setLastTransactionSignature,
  subscribeToDebugState,
} from '../state/debugStore'
import { copyTextToClipboard } from '../utils/copyText'
import { getProgramStatus, refreshProgramStatus, subscribeToProgramStatus } from '../state/programStore'
import type { CreateLockInput, LockRecord, LockSearchField, PreviewLock, TokenType } from '../types/lock'
import { readCreateLockFormState } from '../utils/formValidation'
import { formatUserFacingLockError } from '../utils/lockUiErrors'
import { registerHomeTabActivator } from '../utils/lockDetailNavigation'
import { getSearchTooShortMessage, shouldRunLockSearch } from '../utils/searchQuery'
import { showSuccessToast } from '../utils/toast'
import { executeCreateLockWithProgress } from '../utils/createLock'
import { executeUnlockLock } from '../utils/unlockLock'
import { subscribeToLockUnlocked } from '../utils/unlockEvents'
import {
  connectWallet,
  detectAvailableWallets,
  disconnectWallet,
  getConnectedWalletProvider,
  getWalletConnectionState,
  subscribeToWalletChanges,
  subscribeToWalletConnection,
} from '../wallet'
import { renderClusterAdvancedDetails, renderWalletNetworkSection } from '../components/clusterPanel'
import { renderDebugPanel } from '../components/debugPanel'
import { renderLockPreviewModal } from '../components/lockPreviewModal'
import type { AppTabId } from '../components/mainAppCard'
import { renderHistoryPanel, type HistoryPanelState } from '../components/historySection'
import { renderMyLocksContent } from '../components/myLocksSection'
import {
  enrichLocksWithMintDecimals,
} from '../components/lockTable'
import { renderSearchResults } from '../components/publicLockSearch'
import { attachSiteFooterHandlers } from '../components/siteFooter'
import { renderWalletBar } from '../components/walletPanel'
let pendingLockInput: CreateLockInput | null = null
let pendingPreview: PreviewLock | null = null
let createLockProgressActive = false
let myLocksCache: LockRecord[] = []
let walletLocksCacheKey: string | null = null
let historyLoaded = false
let historyCacheKey: string | null = null
let historyLocksCache: LockRecord[] = []
let historyVisibleCount = 20
const HISTORY_PAGE_SIZE = 20
let publicLocksCache: LockRecord[] = []
let publicSearchCacheKey: string | null = null
let searchIncludeUnlocked = false
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
let appLiveRefreshTimer: ReturnType<typeof setInterval> | null = null
let lastKnownWalletAddress: string | null = null
let myLocksHandlersAttached = false

function getWalletCacheKey(address: string): string {
  return `${getSelectedNetwork()}:${address}`
}

function clearWalletLockCaches(): void {
  myLocksCache = []
  walletLocksCacheKey = null
  historyLoaded = false
  historyCacheKey = null
  historyLocksCache = []
  historyVisibleCount = HISTORY_PAGE_SIZE
}

function clearSearchCache(): void {
  publicLocksCache = []
  publicSearchCacheKey = null
}

export function stopAppLiveRefresh(): void {
  if (appLiveRefreshTimer !== null) {
    clearInterval(appLiveRefreshTimer)
    appLiveRefreshTimer = null
  }
}

function refreshMyLocksDisplay(): void {
  if (shouldPauseBackgroundRpcRefresh()) {
    return
  }

  const results = getMyLocksResultsHost()
  const walletState = getWalletConnectionState()

  if (!results) {
    return
  }

  if (walletState.status !== 'connected' || !walletState.address) {
    renderMyLocksResults(results, [], false, false, null)
    return
  }

  renderMyLocksResults(
    results,
    filterActiveWalletLocks(myLocksCache),
    true,
    false,
    walletState.address,
  )
}

function refreshHistoryDisplay(): void {
  if (shouldPauseBackgroundRpcRefresh()) {
    return
  }

  const results = getHistoryResultsHost()
  const walletState = getWalletConnectionState()

  if (!results) {
    return
  }

  if (walletState.status !== 'connected' || !walletState.address) {
    renderHistoryPanelState(results, { kind: 'disconnected' }, null)
    return
  }

  if (!historyLoaded) {
    renderHistoryPanelState(results, { kind: 'idle' }, walletState.address)
    return
  }

  renderHistoryPanelState(
    results,
    {
      kind: 'ready',
      locks: historyLocksCache,
      visibleCount: historyVisibleCount,
      totalCount: historyLocksCache.length,
    },
    walletState.address,
  )
}

async function handleMyLockUnlock(lockAccount: string, button: HTMLButtonElement): Promise<void> {
  const lock = myLocksCache.find((entry) => entry.lockAccount === lockAccount)

  if (!lock) {
    return
  }

  button.disabled = true

  try {
    const updatedLock = await executeUnlockLock(lock)
    const index = myLocksCache.findIndex((entry) => entry.lockAccount === lockAccount)

    if (index >= 0) {
      myLocksCache[index] = updatedLock
    }

    refreshMyLocksDisplay()

    if (historyLoaded) {
      historyLocksCache = sortLocksNewestFirst(filterHistoryWalletLocks(myLocksCache))
      refreshHistoryDisplay()
    }

    showSuccessToast('Tokens unlocked successfully. Tokens have been returned to your wallet.')
    await refreshMyLocksSection({ force: true, source: 'my-locks:unlock-success' })
  } catch (error) {
    console.error('[CBS Locker] my locks unlock failure', error)
    button.disabled = false
    button.textContent = 'Unlock'
  }
}

function handleLockUnlockedFromDetail(updatedLock: LockRecord): void {
  const index = myLocksCache.findIndex((entry) => entry.lockAccount === updatedLock.lockAccount)

  if (index >= 0) {
    myLocksCache[index] = updatedLock
  }

  refreshMyLocksDisplay()

  if (historyLoaded) {
    historyLocksCache = sortLocksNewestFirst(filterHistoryWalletLocks(myLocksCache))
    refreshHistoryDisplay()
  }

  void refreshMyLocksSection({ force: true, source: 'my-locks:unlock-success' })
}

function refreshPublicLocksDisplay(): void {
  if (shouldPauseBackgroundRpcRefresh()) {
    return
  }

  const results = document.querySelector<HTMLElement>('#publicLockSearchResults')

  if (!results || publicLocksCache.length === 0) {
    return
  }

  results.innerHTML = renderSearchResults(
    filterSearchLocks(publicLocksCache, searchIncludeUnlocked),
    false,
    { includeUnlocked: searchIncludeUnlocked },
  )
}

function startLocalCountdownRefresh(): void {
  stopAppLiveRefresh()
  appLiveRefreshTimer = setInterval(() => {
    refreshMyLocksDisplay()
    refreshHistoryDisplay()
    refreshPublicLocksDisplay()
  }, LIVE_REFRESH_INTERVAL_MS)
}

function refreshWalletNetworkSection(): void {
  const section = document.querySelector<HTMLElement>('#wallet-network-section')

  if (!section) {
    return
  }

  section.innerHTML = `<p class="wallet-bar__section-label">Network</p>${renderWalletNetworkSection()}`
}

function refreshClusterAdvancedDetails(): void {
  const section = document.querySelector<HTMLElement>('#cluster-advanced')

  if (!section) {
    return
  }

  section.outerHTML = renderClusterAdvancedDetails()
}

function refreshNetworkUi(): void {
  refreshWalletNetworkSection()
  refreshClusterAdvancedDetails()
  refreshCreateLockAvailability()
  refreshDebugPanel()
}

function refreshDebugPanel(): void {
  const section = document.querySelector<HTMLElement>('#debug-panel')

  if (!section) {
    return
  }

  section.outerHTML = renderDebugPanel()
  attachDebugCopyHandlers('debugPanel')
  attachDebugOpenLastLockHandler()
}

function attachDebugOpenLastLockHandler(): void {
  const button = document.querySelector<HTMLButtonElement>('#debugOpenLastLockBtn')

  button?.addEventListener('click', () => {
    const lockPda = getDebugState().lastLockPda

    if (!lockPda) {
      return
    }

    navigate(`/lock/${encodeURIComponent(lockPda)}`)
  })
}

function attachDebugCopyHandlers(idPrefix: string): void {
  const button = document.querySelector<HTMLButtonElement>(`#${idPrefix}CopyDebugBtn`)
  const textElement = document.querySelector<HTMLElement>(`#${idPrefix}DebugText`)

  button?.addEventListener('click', async () => {
    const text = textElement?.textContent ?? ''

    if (!text) {
      return
    }

    const copied = await copyTextToClipboard(text)
    button.textContent = copied ? 'Copied' : 'Copy failed'
    window.setTimeout(() => {
      button.textContent = 'Copy Debug Output'
    }, 1800)
  })
}

function extractDiagnostics(error: unknown): SimulationDiagnostics | null {
  if (error instanceof OnChainLockerError && error.diagnostics) {
    return error.diagnostics
  }

  return null
}

function setActiveAppTab(tab: AppTabId): void {
  setRpcActiveTab(tab)

  document.querySelectorAll<HTMLElement>('[data-app-tab-panel]').forEach((panel) => {
    const isActive = panel.dataset.appTabPanel === tab
    panel.hidden = !isActive
    panel.classList.toggle('is-active', isActive)
  })

  document.querySelectorAll<HTMLButtonElement>('[data-app-tab]').forEach((button) => {
    const isActive = button.dataset.appTab === tab
    button.classList.toggle('is-active', isActive)
    button.setAttribute('aria-selected', isActive ? 'true' : 'false')
  })
}

let tabHandlersAttached = false

function handleTabActivated(tab: AppTabId): void {
  if (tab === 'locks') {
    refreshMyLocksDisplay()
  }

  if (tab === 'history') {
    refreshHistoryDisplay()
  }
}

function attachTabHandlers(): void {
  if (tabHandlersAttached) {
    return
  }

  tabHandlersAttached = true

  document.addEventListener('click', (event) => {
    const target = event.target

    if (!(target instanceof HTMLElement)) {
      return
    }

    const tabButton = target.closest<HTMLButtonElement>('[data-app-tab]')

    if (!tabButton) {
      return
    }

    const tab = tabButton.dataset.appTab as AppTabId | undefined

    if (!tab) {
      return
    }

    setActiveAppTab(tab)
    handleTabActivated(tab)
  })

  document.addEventListener('click', (event) => {
    const target = event.target

    if (!(target instanceof HTMLElement)) {
      return
    }

    const tabLink = target.closest<HTMLElement>('[data-app-tab-link]')

    if (!tabLink) {
      return
    }

    const tab = tabLink.dataset.appTabLink as AppTabId | undefined

    if (!tab) {
      return
    }

    setActiveAppTab(tab)
    handleTabActivated(tab)
  })

  if (window.location.hash === '#my-locks') {
    setActiveAppTab('locks')
    refreshMyLocksDisplay()
  }
}

function refreshWalletPanel(): void {
  const walletBar = document.querySelector<HTMLElement>('#wallet-bar')

  if (!walletBar) {
    return
  }

  walletBar.outerHTML = renderWalletBar()
  attachWalletHandlers()
  refreshCreateLockAvailability()
  refreshDebugPanel()
  refreshMyLocksDisplay()
}

function refreshCreateLockAvailability(): void {
  const form = document.querySelector<HTMLFormElement>('#createLockForm')
  const createButton = document.querySelector<HTMLButtonElement>('#createLockBtn')
  const formState = readCreateLockFormState(form)

  if (createButton) {
    createButton.disabled = !formState.canCreate || createLockProgressActive
    createButton.title = createLockProgressActive
      ? 'Create lock is in progress.'
      : !formState.canCreate
        ? formState.disableReasons.join(' ')
        : ''
  }
}

function getMyLocksResultsHost(): HTMLElement | null {
  const panel = document.querySelector<HTMLElement>('[data-app-tab-panel="locks"]')
  return panel?.querySelector<HTMLElement>('#myLocksResults') ?? document.querySelector<HTMLElement>('#myLocksResults')
}

function renderMyLocksResults(
  host: HTMLElement,
  locks: LockRecord[],
  walletConnected: boolean,
  loading: boolean,
  connectedWallet: string | null,
  errorMessage: string | null = null,
  errorDetails: string | null = null,
): void {
  host.innerHTML = renderMyLocksContent(
    locks,
    walletConnected,
    loading,
    connectedWallet,
    errorMessage,
    errorDetails,
  )
}

function getHistoryResultsHost(): HTMLElement | null {
  const panel = document.querySelector<HTMLElement>('[data-app-tab-panel="history"]')
  return panel?.querySelector<HTMLElement>('#historyResults') ?? document.querySelector<HTMLElement>('#historyResults')
}

function renderHistoryPanelState(
  host: HTMLElement,
  state: HistoryPanelState,
  connectedWallet: string | null,
): void {
  host.innerHTML = renderHistoryPanel(state, connectedWallet)
}

async function ensureWalletLocksCache(
  walletAddress: string,
  force = false,
  source = 'my-locks:fetch',
): Promise<LockRecord[]> {
  const cacheKey = getWalletCacheKey(walletAddress)

  if (!force && walletLocksCacheKey === cacheKey) {
    return myLocksCache
  }

  myLocksCache = await withRpcCallSource(source, () => fetchWalletLocksFromApi(walletAddress))
  await enrichLocksWithMintDecimals(myLocksCache)
  walletLocksCacheKey = cacheKey
  return myLocksCache
}

async function refreshMyLocksSection(options?: {
  force?: boolean
  source?: string
}): Promise<void> {
  if (!options?.force && shouldPauseBackgroundRpcRefresh()) {
    return
  }

  const myLocksResults = getMyLocksResultsHost()
  const walletState = getWalletConnectionState()

  if (!myLocksResults) {
    return
  }

  if (walletState.status !== 'connected' || !walletState.address) {
    renderMyLocksResults(myLocksResults, [], false, false, null)
    return
  }

  renderMyLocksResults(myLocksResults, [], true, true, walletState.address)

  try {
    await ensureWalletLocksCache(
      walletState.address,
      options?.force ?? false,
      options?.source ?? (options?.force ? 'my-locks:refresh' : 'my-locks:load'),
    )

    const resultsAfterFetch = getMyLocksResultsHost()

    if (!resultsAfterFetch) {
      return
    }

    renderMyLocksResults(
      resultsAfterFetch,
      filterActiveWalletLocks(myLocksCache),
      true,
      false,
      walletState.address,
    )

    if (historyLoaded && historyCacheKey === getWalletCacheKey(walletState.address)) {
      historyLocksCache = sortLocksNewestFirst(filterHistoryWalletLocks(myLocksCache))
      refreshHistoryDisplay()
    }
  } catch (error) {
    setLastError(formatLockerError(error, getSelectedClusterLabel()))
    walletLocksCacheKey = null
    myLocksCache = []

    const { message, details } = formatUserFacingLockError(error, getSelectedClusterLabel())
    const resultsAfterError = getMyLocksResultsHost()

    if (resultsAfterError) {
      renderMyLocksResults(resultsAfterError, [], true, false, walletState.address, message, details)
    }
  }
}

async function loadHistory(options?: { force?: boolean }): Promise<void> {
  const historyResults = getHistoryResultsHost()
  const walletState = getWalletConnectionState()

  if (!historyResults) {
    return
  }

  if (walletState.status !== 'connected' || !walletState.address) {
    renderHistoryPanelState(historyResults, { kind: 'disconnected' }, null)
    return
  }

  renderHistoryPanelState(historyResults, { kind: 'loading' }, walletState.address)

  try {
    await ensureWalletLocksCache(
      walletState.address,
      options?.force ?? false,
      options?.force ? 'history:refresh' : 'history:load',
    )

    historyLocksCache = sortLocksNewestFirst(filterHistoryWalletLocks(myLocksCache))
    historyLoaded = true
    historyCacheKey = getWalletCacheKey(walletState.address)
    historyVisibleCount = HISTORY_PAGE_SIZE

    const host = getHistoryResultsHost()

    if (!host) {
      return
    }

    renderHistoryPanelState(
      host,
      {
        kind: 'ready',
        locks: historyLocksCache,
        visibleCount: historyVisibleCount,
        totalCount: historyLocksCache.length,
      },
      walletState.address,
    )
  } catch (error) {
    setLastError(formatLockerError(error, getSelectedClusterLabel()))
    const { message, details } = formatUserFacingLockError(error, getSelectedClusterLabel())
    const host = getHistoryResultsHost()

    if (host) {
      renderHistoryPanelState(host, { kind: 'error', message, details }, walletState.address)
    }
  }
}

function loadMoreHistory(): void {
  const walletState = getWalletConnectionState()
  const host = getHistoryResultsHost()

  if (!host || !historyLoaded) {
    return
  }

  historyVisibleCount += HISTORY_PAGE_SIZE

  renderHistoryPanelState(
    host,
    {
      kind: 'ready',
      locks: historyLocksCache,
      visibleCount: historyVisibleCount,
      totalCount: historyLocksCache.length,
    },
    walletState.address,
  )
}

async function refreshPublicSearchSection(): Promise<void> {
  if (shouldPauseBackgroundRpcRefresh()) {
    return
  }

  const searchInput = document.querySelector<HTMLInputElement>('#publicLockSearchInput')
  const searchField = document.querySelector<HTMLSelectElement>('#publicLockSearchField')
  const resultsHost = document.querySelector<HTMLElement>('#publicLockSearchResults')

  if (!resultsHost) {
    return
  }

  const query = searchInput?.value ?? ''
  const field = (searchField?.value ?? 'all') as LockSearchField

  if (!query.trim()) {
    clearSearchCache()
    resultsHost.innerHTML = ''
    return
  }

  if (!shouldRunLockSearch(query, field)) {
    clearSearchCache()
    resultsHost.innerHTML = renderSearchResults([], false, {
      hintMessage: getSearchTooShortMessage(),
    })
    return
  }

  const cacheKey = `${getSelectedNetwork()}:${field}:${query.trim()}`

  if (publicSearchCacheKey === cacheKey) {
    resultsHost.innerHTML = renderSearchResults(
      filterSearchLocks(publicLocksCache, searchIncludeUnlocked),
      false,
      { includeUnlocked: searchIncludeUnlocked },
    )
    return
  }

  resultsHost.innerHTML = renderSearchResults([], true)

  try {
    const locks = await withRpcCallSource('search:query', () => searchLocksFromApi(query, field))
    publicLocksCache = locks
    publicSearchCacheKey = cacheKey
    await enrichLocksWithMintDecimals(locks)

    resultsHost.innerHTML = renderSearchResults(
      filterSearchLocks(locks, searchIncludeUnlocked),
      false,
      { includeUnlocked: searchIncludeUnlocked },
    )
  } catch (error) {
    setLastError(formatLockerError(error, getSelectedClusterLabel()))
    clearSearchCache()

    const { message, details } = formatUserFacingLockError(error, getSelectedClusterLabel())
    resultsHost.innerHTML = renderSearchResults([], false, {
      errorMessage: message,
      errorDetails: details,
    })
  }
}

function schedulePublicSearch(): void {
  if (searchDebounceTimer !== null) {
    clearTimeout(searchDebounceTimer)
  }

  searchDebounceTimer = setTimeout(() => {
    searchDebounceTimer = null
    void refreshPublicSearchSection()
  }, 750)
}

let clusterHandlersAttached = false

function handleNetworkSwitch(network: SolanaNetwork): void {
  setSelectedNetwork(network)
  resetRpcCache()
  logRpcConfiguration(network)
  pendingPreview = null
  pendingLockInput = null
  clearWalletLockCaches()
  clearSearchCache()

  void refreshProgramStatus(network).then(() => {
    refreshNetworkUi()
    refreshHistoryDisplay()

    const walletState = getWalletConnectionState()

    if (walletState.status === 'connected' && walletState.address) {
      void refreshMyLocksSection({ force: true, source: 'my-locks:network-change' })
    } else {
      refreshMyLocksDisplay()
    }

    const searchInput = document.querySelector<HTMLInputElement>('#publicLockSearchInput')
    const searchField = document.querySelector<HTMLSelectElement>('#publicLockSearchField')
    const query = searchInput?.value ?? ''
    const field = (searchField?.value ?? 'all') as LockSearchField

    if (query.trim() && shouldRunLockSearch(query, field)) {
      void refreshPublicSearchSection()
    } else {
      refreshPublicLocksDisplay()
    }
  })
}

function attachClusterHandlers(): void {
  if (clusterHandlersAttached) {
    return
  }

  clusterHandlersAttached = true

  document.addEventListener('change', (event) => {
    const target = event.target

    if (!(target instanceof HTMLSelectElement) || target.id !== 'clusterSelect') {
      return
    }

    const value = target.value

    if (value !== 'devnet' && value !== 'mainnet') {
      return
    }

    handleNetworkSwitch(value)
  })

  document.addEventListener('click', (event) => {
    const target = event.target

    if (!(target instanceof HTMLButtonElement) || target.id !== 'refreshProgramStatusBtn') {
      return
    }

    void refreshProgramStatus(getSelectedNetwork(), { force: true }).then(() => {
      refreshNetworkUi()
    })
  })
}

function attachWalletHandlers(): void {
  const connectButton = document.querySelector<HTMLButtonElement>('#connectWalletBtn')
  const disconnectButton = document.querySelector<HTMLButtonElement>('#disconnectWalletBtn')
  const walletSelect = document.querySelector<HTMLSelectElement>('#walletSelect')

  connectButton?.addEventListener('click', async () => {
    const walletId = walletSelect?.value

    if (!walletId) {
      return
    }

    await connectWallet(walletId)
    refreshWalletPanel()
    refreshDebugPanel()
  })

  disconnectButton?.addEventListener('click', async () => {
    await disconnectWallet()
    pendingPreview = null
    pendingLockInput = null
    clearWalletLockCaches()
    clearSearchCache()
    refreshWalletPanel()
    refreshDebugPanel()
    refreshHistoryDisplay()
  })
}

function readCreateLockInput(form: HTMLFormElement): CreateLockInput {
  const walletState = getWalletConnectionState()
  const formData = new FormData(form)

  return {
    projectName: String(formData.get('projectName') ?? ''),
    tokenMint: String(formData.get('tokenMint') ?? ''),
    tokenType: String(formData.get('tokenType') ?? 'spl') as TokenType,
    amount: String(formData.get('amount') ?? ''),
    unlockDate: String(formData.get('unlockDate') ?? ''),
    unlockTime: String(formData.get('unlockTime') ?? ''),
    projectDescription: String(formData.get('projectDescription') ?? ''),
    lockerWallet: walletState.address ?? '',
  }
}

function showCreateLockSuccess(): void {
  const successElement = document.querySelector<HTMLElement>('#createLockSuccess')
  const errorElement = document.querySelector<HTMLElement>('#createLockError')

  if (errorElement) {
    errorElement.textContent = ''
    errorElement.hidden = true
  }

  document.querySelector('#createLockSimulationDebug')?.remove()

  if (!successElement) {
    return
  }

  successElement.hidden = false
}

function showCreateLockError(message: string, diagnostics: SimulationDiagnostics | null = null): void {
  const successElement = document.querySelector<HTMLElement>('#createLockSuccess')

  if (successElement) {
    successElement.hidden = true
  }

  const errorElement = document.querySelector<HTMLElement>('#createLockError')

  if (!errorElement) {
    return
  }

  document.querySelector('#createLockSimulationDebug')?.remove()

  errorElement.textContent = message
  errorElement.hidden = false

  if (diagnostics) {
    errorElement.insertAdjacentHTML(
      'afterend',
      renderSimulationDebugBlock(diagnostics, {
        idPrefix: 'createLock',
        showCopyButton: true,
      }),
    )
    attachDebugCopyHandlers('createLock')
  }

  setLastError(message)
  setLastSimulationDiagnostics(diagnostics)
  refreshDebugPanel()
}

function clearCreateLockError(): void {
  const errorElement = document.querySelector<HTMLElement>('#createLockError')
  const successElement = document.querySelector<HTMLElement>('#createLockSuccess')

  if (successElement) {
    successElement.hidden = true
  }

  if (!errorElement) {
    return
  }

  errorElement.textContent = ''
  errorElement.hidden = true
  document.querySelector('#createLockSimulationDebug')?.remove()
  clearSimulationDiagnostics()
}

function closeLockPreviewModal(): void {
  document.querySelector('[data-lock-preview-modal]')?.remove()
}

function openLockPreviewModal(preview: PreviewLock): void {
  closeLockPreviewModal()
  document.body.insertAdjacentHTML('beforeend', renderLockPreviewModal(preview))

  const modal = document.querySelector('[data-lock-preview-modal]')

  modal?.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeLockPreviewModal()
    }
  })

  modal?.querySelector('[data-lock-preview-cancel]')?.addEventListener('click', () => {
    closeLockPreviewModal()
  })

  modal?.querySelector('[data-lock-preview-confirm]')?.addEventListener('click', async () => {
    if (!pendingLockInput) {
      return
    }

    const programStatus = getProgramStatus()

    if (!programStatus.statusKnown && programStatus.error) {
      showCreateLockError(programStatus.error)
      closeLockPreviewModal()
      return
    }

    if (!programStatus.deployed) {
      showCreateLockError(
        `CBS Locker Program is not deployed on ${getSelectedClusterLabel()} yet.`,
      )
      closeLockPreviewModal()
      return
    }

    const walletProvider = getConnectedWalletProvider()

    if (!walletProvider) {
      showCreateLockError('Connect your wallet before creating an on-chain lock.')
      closeLockPreviewModal()
      return
    }

    closeLockPreviewModal()
    clearCreateLockError()

    createLockProgressActive = true
    setLockCreationInProgress(true)
    stopAppLiveRefresh()
    refreshCreateLockAvailability()

    let createdLock: LockRecord | null = null

    try {
      createdLock = await executeCreateLockWithProgress(pendingLockInput, walletProvider)
      pendingPreview = null
      pendingLockInput = null
      setLastTransactionSignature(createdLock.createSignature ?? null)
      setLastLockPdas(createdLock.lockAccount, createdLock.vault)
      setLastError(null)
      clearSimulationDiagnostics()
      refreshDebugPanel()
      showCreateLockSuccess()
      await refreshMyLocksSection({ force: true, source: 'my-locks:create-success' })
    } catch (error) {
      const diagnostics = extractDiagnostics(error)
      const message =
        error instanceof OnChainLockerError
          ? error.message
          : formatLockerError(error, getSelectedClusterLabel())

      showCreateLockError(message, diagnostics)
    } finally {
      createLockProgressActive = false
      setLockCreationInProgress(false)
      startLocalCountdownRefresh()
      refreshCreateLockAvailability()
    }
  })
}

function attachCreateLockHandlers(): void {
  const form = document.querySelector<HTMLFormElement>('#createLockForm')

  const handleFormChange = () => {
    clearCreateLockError()
    refreshCreateLockAvailability()
  }

  form?.querySelectorAll('input, select, textarea').forEach((field) => {
    field.addEventListener('input', handleFormChange)
    field.addEventListener('change', handleFormChange)
  })

  form?.addEventListener('submit', (event) => {
    event.preventDefault()
    clearCreateLockError()

    if (!form) {
      return
    }

    const formState = readCreateLockFormState(form)

    if (!formState.canCreate) {
      showCreateLockError(formState.disableReasons.join(' '))
      return
    }

    try {
      pendingLockInput = readCreateLockInput(form)
      pendingPreview = buildLockPreview(pendingLockInput)
      openLockPreviewModal(pendingPreview)
    } catch (error) {
      pendingPreview = null
      pendingLockInput = null
      const message =
        error instanceof LockerValidationError
          ? error.message
          : 'Unable to prepare lock details.'

      showCreateLockError(message)
      refreshCreateLockAvailability()
    }
  })
}

function attachMyLocksHandlers(): void {
  if (myLocksHandlersAttached) {
    return
  }

  myLocksHandlersAttached = true

  document.addEventListener('click', (event) => {
    const target = event.target

    if (!(target instanceof HTMLElement)) {
      return
    }

    if (target.closest('[data-refresh-my-locks]')) {
      void refreshMyLocksSection({ force: true, source: 'my-locks:manual-refresh' })
      return
    }

    const unlockButton = target.closest<HTMLButtonElement>('[data-unlock-lock]')

    if (!unlockButton || unlockButton.disabled) {
      return
    }

    const lockAccount = unlockButton.dataset.unlockLock

    if (!lockAccount) {
      return
    }

    void handleMyLockUnlock(lockAccount, unlockButton)
  })
}

let historyHandlersAttached = false
let searchHandlersAttached = false

function attachHistoryHandlers(): void {
  if (historyHandlersAttached) {
    return
  }

  historyHandlersAttached = true

  document.addEventListener('click', (event) => {
    const target = event.target

    if (!(target instanceof HTMLElement)) {
      return
    }

    if (target.closest('[data-load-history]')) {
      void loadHistory()
      return
    }

    if (target.closest('[data-refresh-history]')) {
      void loadHistory({ force: true })
      return
    }

    if (target.closest('[data-load-more-history]')) {
      loadMoreHistory()
    }
  })
}

function syncSearchRoute(): void {
  const searchInput = document.querySelector<HTMLInputElement>('#publicLockSearchInput')
  const searchField = document.querySelector<HTMLSelectElement>('#publicLockSearchField')
  const query = searchInput?.value ?? ''
  const field = (searchField?.value ?? 'all') as LockSearchField
  const nextPath = getPublicLocksPath(query, field)

  if (window.location.pathname.startsWith('/locks')) {
    navigate(nextPath)
  }
}

function attachPublicSearchHandlers(): void {
  if (searchHandlersAttached) {
    return
  }

  searchHandlersAttached = true

  document.addEventListener('input', (event) => {
    const target = event.target

    if (!(target instanceof HTMLInputElement) || target.id !== 'publicLockSearchInput') {
      return
    }

    syncSearchRoute()
    schedulePublicSearch()
  })

  document.addEventListener('change', (event) => {
    const target = event.target

    if (target instanceof HTMLSelectElement && target.id === 'publicLockSearchField') {
      clearSearchCache()
      syncSearchRoute()
      schedulePublicSearch()
      return
    }

    if (
      target instanceof HTMLInputElement &&
      target.matches('[data-search-include-unlocked]')
    ) {
      searchIncludeUnlocked = target.checked
      refreshPublicLocksDisplay()
    }
  })
}

export function attachAppHandlers(): void {
  registerHomeTabActivator((tab) => {
    setActiveAppTab(tab)
    handleTabActivated(tab)
  })

  attachSiteFooterHandlers()
  attachClusterHandlers()
  attachWalletHandlers()
  attachCreateLockHandlers()
  attachTabHandlers()
  attachHistoryHandlers()
  attachMyLocksHandlers()
  startLocalCountdownRefresh()
  attachPublicSearchHandlers()
  refreshCreateLockAvailability()

  const walletState = getWalletConnectionState()
  lastKnownWalletAddress = walletState.address

  subscribeToWalletConnection(() => {
    const nextWalletState = getWalletConnectionState()
    const nextAddress = nextWalletState.address

    if (nextAddress !== lastKnownWalletAddress) {
      clearWalletLockCaches()
      lastKnownWalletAddress = nextAddress

      if (nextWalletState.status === 'connected' && nextAddress) {
        void refreshMyLocksSection({ force: true, source: 'my-locks:wallet-change' })
      } else {
        refreshMyLocksDisplay()
      }
    } else {
      refreshMyLocksDisplay()
    }

    refreshCreateLockAvailability()
    refreshDebugPanel()

    if (historyLoaded) {
      refreshHistoryDisplay()
    }
  })

  subscribeToWalletChanges(() => {
    if (detectAvailableWallets().length > 0) {
      refreshWalletPanel()
    }
  })

  subscribeToProgramStatus(() => {
    refreshWalletNetworkSection()
    refreshCreateLockAvailability()
    refreshDebugPanel()
  })

  subscribeToLockUnlocked(handleLockUnlockedFromDetail)

  subscribeToDebugState(() => {
    refreshDebugPanel()
  })

  if (isDebugPanelVisible()) {
    subscribeToRpcCallTracker(() => {
      refreshDebugPanel()
    })
  }

  refreshHistoryDisplay()
}

export async function loadPublicLocksPage(query = '', field: LockSearchField = 'all'): Promise<void> {
  const searchInput = document.querySelector<HTMLInputElement>('#publicLockSearchInput')
  const searchField = document.querySelector<HTMLSelectElement>('#publicLockSearchField')

  if (searchInput) {
    searchInput.value = query
  }

  if (searchField) {
    searchField.value = field
  }

  clearSearchCache()

  if (query.trim() && shouldRunLockSearch(query, field)) {
    await refreshPublicSearchSection()
  }
}
