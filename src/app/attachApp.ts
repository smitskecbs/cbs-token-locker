import {
  buildLockPreview,
  filterMyLocks,
  LockerValidationError,
} from '../locker'
import { getPublicLocksPath, navigate } from '../routes'
import { fetchWalletLocksFromApi, searchLocksFromApi } from '../services/lockApi'
import {
  getSelectedClusterLabel,
  getSelectedNetwork,
  setSelectedNetwork,
  subscribeToClusterChanges,
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
  clearSimulationDiagnostics,
  getDebugState,
  setLastError,
  setLastLockPdas,
  setLastSimulationDiagnostics,
  setLastTransactionSignature,
  subscribeToDebugState,
} from '../state/debugStore'
import { copyTextToClipboard } from '../utils/copyText'
import { getProgramStatus, refreshProgramStatus, subscribeToProgramStatus } from '../state/programStore'
import type { CreateLockInput, LockRecord, LockSearchField, MyLocksFilter, PreviewLock, TokenType } from '../types/lock'
import { readCreateLockFormState } from '../utils/formValidation'
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
import { renderClusterPanel } from '../components/clusterPanel'
import { renderDebugPanel } from '../components/debugPanel'
import { renderLockPreviewModal } from '../components/lockPreviewModal'
import { renderMyLocksSection } from '../components/myLocksSection'
import {
  enrichLocksWithMintDecimals,
  renderLockSummaryList,
  renderLockTable,
  updateLockTableRow,
} from '../components/lockTable'
import { renderPublicLockSearch } from '../components/publicLockSearch'
import { renderWalletPanel } from '../components/walletPanel'
let pendingLockInput: CreateLockInput | null = null
let pendingPreview: PreviewLock | null = null
let createLockProgressActive = false
let myLocksFilter: MyLocksFilter = 'all'
let myLocksCache: LockRecord[] = []
let publicLocksCache: LockRecord[] = []
let appLiveRefreshTimer: ReturnType<typeof setInterval> | null = null

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

  const results = document.querySelector<HTMLElement>('#myLocksResults')
  const walletState = getWalletConnectionState()

  if (!results) {
    return
  }

  results.innerHTML = renderLockTable(
    filterMyLocks(myLocksCache, myLocksFilter),
    'No on-chain locks match the selected filter for your connected wallet.',
    Date.now(),
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

    updateLockTableRow(updatedLock, getWalletConnectionState().address)
    showSuccessToast('Tokens unlocked successfully.')
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
    updateLockTableRow(updatedLock, getWalletConnectionState().address)
  }
}

function refreshPublicLocksDisplay(): void {
  if (shouldPauseBackgroundRpcRefresh()) {
    return
  }

  const results = document.querySelector<HTMLElement>('#publicLockSearchResults')

  if (!results || publicLocksCache.length === 0) {
    return
  }

  results.innerHTML = renderLockSummaryList(publicLocksCache, Date.now())
}

function startAppLiveRefresh(): void {
  stopAppLiveRefresh()
  appLiveRefreshTimer = setInterval(() => {
    refreshMyLocksDisplay()
    refreshPublicLocksDisplay()
  }, LIVE_REFRESH_INTERVAL_MS)
}

function refreshClusterPanel(): void {
  const section = document.querySelector<HTMLElement>('#cluster')

  if (!section) {
    return
  }

  section.outerHTML = renderClusterPanel()
  attachClusterHandlers()
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

function refreshWalletPanel(): void {
  const walletSection = document.querySelector<HTMLElement>('#wallet')

  if (!walletSection) {
    return
  }

  walletSection.outerHTML = renderWalletPanel()
  attachWalletHandlers()
  refreshCreateLockAvailability()
  refreshDebugPanel()
  void refreshMyLocksSection()
}

function refreshCreateLockAvailability(): void {
  const form = document.querySelector<HTMLFormElement>('#createLockForm')
  const createButton = document.querySelector<HTMLButtonElement>('#createLockBtn')
  const previewButton = document.querySelector<HTMLButtonElement>('#previewLockBtn')
  const formState = readCreateLockFormState(form)

  if (createButton) {
    createButton.disabled =
      !formState.canCreate || !pendingPreview || createLockProgressActive
    createButton.title = createLockProgressActive
      ? 'Create lock is in progress.'
      : !formState.canCreate
      ? formState.disableReasons.join(' ')
      : !pendingPreview
        ? 'Preview the lock before submitting on-chain.'
        : ''
  }

  if (previewButton) {
    previewButton.disabled = !formState.canPreview
    previewButton.title = !formState.canPreview ? formState.disableReasons.filter((reason) => {
      return !reason.includes('Deploy the CBS Locker Program')
    }).join(' ') : ''
  }
}

async function refreshMyLocksSection(): Promise<void> {
  if (shouldPauseBackgroundRpcRefresh()) {
    return
  }

  const section = document.querySelector<HTMLElement>('#my-locks')
  const walletState = getWalletConnectionState()

  if (!section) {
    return
  }

  if (walletState.status !== 'connected' || !walletState.address) {
    section.outerHTML = renderMyLocksSection([], myLocksFilter, false, false)
    attachMyLocksHandlers()
    return
  }

  section.outerHTML = renderMyLocksSection([], myLocksFilter, true, true)
  attachMyLocksHandlers()

  try {
    myLocksCache = await fetchWalletLocksFromApi(walletState.address)
    await enrichLocksWithMintDecimals(myLocksCache)
  } catch (error) {
    setLastError(formatLockerError(error, getSelectedClusterLabel()))
    myLocksCache = []
  }

  const refreshedSection = document.querySelector<HTMLElement>('#my-locks')

  if (!refreshedSection) {
    return
  }

  refreshedSection.outerHTML = renderMyLocksSection(
    filterMyLocks(myLocksCache, myLocksFilter),
    myLocksFilter,
    true,
    false,
  )
  attachMyLocksHandlers()
}

function attachClusterHandlers(): void {
  const clusterSelect = document.querySelector<HTMLSelectElement>('#clusterSelect')
  const refreshButton = document.querySelector<HTMLButtonElement>('#refreshProgramStatusBtn')

  clusterSelect?.addEventListener('change', () => {
    const value = clusterSelect.value

    if (value !== 'devnet' && value !== 'mainnet') {
      return
    }

    setSelectedNetwork(value)
    resetRpcCache()
    logRpcConfiguration(value)
    pendingPreview = null
    pendingLockInput = null
    void refreshProgramStatus(value).then(() => {
      refreshClusterPanel()
      refreshCreateLockAvailability()
    })
  })

  refreshButton?.addEventListener('click', () => {
    void refreshProgramStatus(getSelectedNetwork()).then(() => {
      refreshClusterPanel()
      refreshCreateLockAvailability()
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
    refreshWalletPanel()
    refreshDebugPanel()
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

function showCreateLockSuccess(message: string): void {
  const successElement = document.querySelector<HTMLElement>('#createLockSuccess')
  const errorElement = document.querySelector<HTMLElement>('#createLockError')

  if (errorElement) {
    errorElement.textContent = ''
    errorElement.hidden = true
  }

  if (!successElement) {
    return
  }

  successElement.textContent = message
  successElement.hidden = false
}

function showCreateLockError(message: string, diagnostics: SimulationDiagnostics | null = null): void {
  const successElement = document.querySelector<HTMLElement>('#createLockSuccess')

  if (successElement) {
    successElement.textContent = ''
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
    successElement.textContent = ''
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
      await refreshMyLocksSection()
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
      startAppLiveRefresh()
      refreshCreateLockAvailability()
    }
  })
}

function attachCreateLockHandlers(): void {
  const form = document.querySelector<HTMLFormElement>('#createLockForm')
  const createButton = document.querySelector<HTMLButtonElement>('#createLockBtn')

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

    if (!formState.canPreview) {
      showCreateLockError(formState.disableReasons.join(' '))
      return
    }

    try {
      pendingLockInput = readCreateLockInput(form)
      pendingPreview = buildLockPreview(pendingLockInput)
      openLockPreviewModal(pendingPreview)
      refreshCreateLockAvailability()
    } catch (error) {
      pendingPreview = null
      pendingLockInput = null
      const message =
        error instanceof LockerValidationError
          ? error.message
          : 'Unable to prepare lock preview.'

      showCreateLockError(message)
      refreshCreateLockAvailability()
    }
  })

  createButton?.addEventListener('click', () => {
    const formState = readCreateLockFormState(form)

    if (!formState.canCreate) {
      showCreateLockError(formState.disableReasons.join(' '))
      return
    }

    if (!pendingPreview || !pendingLockInput) {
      showCreateLockError('Preview the lock before creating an on-chain lock.')
      return
    }

    openLockPreviewModal(pendingPreview)
  })
}

function attachMyLocksHandlers(): void {
  const searchInput = document.querySelector<HTMLInputElement>('#myLocksSearch')
  const results = document.querySelector<HTMLElement>('#myLocksResults')

  if (results && !results.dataset.unlockHandlersAttached) {
    results.dataset.unlockHandlersAttached = 'true'
    results.addEventListener('click', (event) => {
      const target = event.target

      if (!(target instanceof HTMLElement)) {
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

  const renderResults = (query = '') => {
    if (!results) {
      return
    }

    const normalizedQuery = query.trim().toLowerCase()
    const filteredByStatus = filterMyLocks(myLocksCache, myLocksFilter)

    const filteredLocks = normalizedQuery
      ? filteredByStatus.filter((lock) => {
          return (
            lock.projectName.toLowerCase().includes(normalizedQuery) ||
            lock.lockAccount.toLowerCase().includes(normalizedQuery)
          )
        })
      : filteredByStatus

    results.innerHTML = renderLockTable(
      filteredLocks,
      'No on-chain locks match the selected filter for your connected wallet.',
      Date.now(),
      getWalletConnectionState().address,
    )
  }

  searchInput?.addEventListener('input', () => {
    renderResults(searchInput.value)
  })

  document.querySelectorAll<HTMLButtonElement>('[data-my-locks-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      myLocksFilter = button.dataset.myLocksFilter as MyLocksFilter
      void refreshMyLocksSection()
    })
  })

  renderResults(searchInput?.value ?? '')
}

function attachPublicSearchHandlers(): void {
  const searchInput = document.querySelector<HTMLInputElement>('#publicLockSearchInput')
  const searchField = document.querySelector<HTMLSelectElement>('#publicLockSearchField')
  const resultsHost = document.querySelector<HTMLElement>('#public-locks')

  const renderResults = async () => {
    if (!resultsHost) {
      return
    }

    const query = searchInput?.value ?? ''
    const field = (searchField?.value ?? 'all') as LockSearchField

    resultsHost.innerHTML = renderPublicLockSearch([], query, field, true)

    try {
      const locks = query ? await searchLocksFromApi(query, field) : []
      publicLocksCache = locks
      await enrichLocksWithMintDecimals(locks)
      resultsHost.innerHTML = renderPublicLockSearch(locks, query, field, false)
    } catch (error) {
      setLastError(formatLockerError(error, getSelectedClusterLabel()))
      resultsHost.innerHTML = renderPublicLockSearch([], query, field, false)
    }

    attachPublicSearchHandlers()
  }

  const syncRoute = () => {
    const query = searchInput?.value ?? ''
    const field = (searchField?.value ?? 'all') as LockSearchField
    const nextPath = getPublicLocksPath(query, field)

    if (window.location.pathname.startsWith('/locks')) {
      navigate(nextPath)
    }
  }

  searchInput?.addEventListener('input', () => {
    void renderResults()
    syncRoute()
  })

  searchField?.addEventListener('change', () => {
    void renderResults()
    syncRoute()
  })
}

function attachScrollTargets(): void {
  document.querySelectorAll<HTMLElement>('[data-scroll-target]').forEach((element) => {
    element.addEventListener('click', () => {
      const targetSelector = element.dataset.scrollTarget

      if (!targetSelector) {
        return
      }

      document.querySelector(targetSelector)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })
  })
}

export function attachAppHandlers(): void {
  attachClusterHandlers()
  attachWalletHandlers()
  attachCreateLockHandlers()
  attachMyLocksHandlers()
  startAppLiveRefresh()
  attachPublicSearchHandlers()
  attachScrollTargets()
  refreshCreateLockAvailability()

  subscribeToWalletConnection(() => {
    refreshCreateLockAvailability()
    refreshDebugPanel()
  })

  subscribeToWalletChanges(() => {
    if (detectAvailableWallets().length > 0) {
      refreshWalletPanel()
    }
  })

  subscribeToProgramStatus(() => {
    refreshClusterPanel()
    refreshCreateLockAvailability()
    refreshDebugPanel()
  })

  subscribeToLockUnlocked(handleLockUnlockedFromDetail)

  subscribeToClusterChanges((network: SolanaNetwork) => {
    void refreshProgramStatus(network)
  })

  subscribeToDebugState(() => {
    refreshDebugPanel()
  })
}

export async function loadPublicLocksPage(query = '', field: LockSearchField = 'all'): Promise<void> {
  const host = document.querySelector<HTMLElement>('#public-locks')

  if (!host) {
    return
  }

  host.outerHTML = renderPublicLockSearch([], query, field, true)

  try {
    const locks = query ? await searchLocksFromApi(query, field) : []
    publicLocksCache = locks
    await enrichLocksWithMintDecimals(locks)
    const replacement = document.querySelector<HTMLElement>('#public-locks')

    if (replacement) {
      replacement.outerHTML = renderPublicLockSearch(locks, query, field, false)
    }
  } catch (error) {
    setLastError(formatLockerError(error, getSelectedClusterLabel()))
  }

  attachPublicSearchHandlers()
}
