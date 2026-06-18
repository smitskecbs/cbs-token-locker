import type { LockMode } from '../types/splitLock'
import {
  formatDateInput,
  formatTimeInput,
  SPLIT_LOCK_MAX_UNLOCKS,
  SPLIT_LOCK_MIN_UNLOCKS,
} from '../utils/vestingSchedule'

function getDefaultUnlockDateTime(): { date: string; time: string; minDate: string } {
  const defaultUnlock = new Date(Date.now() + 10 * 60 * 1000)

  return {
    date: formatDateInput(defaultUnlock),
    time: formatTimeInput(defaultUnlock),
    minDate: formatDateInput(new Date()),
  }
}

function getDefaultSplitFirstUnlock(): { date: string; time: string } {
  const defaultFirst = new Date()
  defaultFirst.setFullYear(defaultFirst.getFullYear() + 1)

  return {
    date: formatDateInput(defaultFirst),
    time: formatTimeInput(defaultFirst),
  }
}

const SPL_MINT_LABEL = 'Token Mint Address'
const SPL_MINT_HINT = 'Paste the SPL token mint address you want to lock.'
const SPL_AMOUNT_LABEL = 'Amount'
const SPL_AMOUNT_HINT = 'Enter the normal token amount, not raw decimals.'

const LP_MINT_LABEL = 'LP Token Mint Address'
const LP_MINT_HINT =
  'Paste the LP token mint address from your wallet. Do not paste the pool address, pair address or vault address.'
const LP_AMOUNT_LABEL = 'LP Token Amount'
const LP_AMOUNT_HINT = 'Enter the LP token amount shown in your wallet, not raw decimals.'

const SPLIT_TOTAL_LABEL = 'Total Amount'
const SPLIT_TOTAL_HINT = 'Total tokens to split across all locks, not raw decimals.'

export function readLockMode(form?: HTMLFormElement | null): LockMode {
  const selected = form?.querySelector<HTMLInputElement>('input[name="lockMode"]:checked')

  return selected?.value === 'split' ? 'split' : 'single'
}

export function syncCreateLockTokenTypeUi(tokenType: 'spl' | 'lp' = 'spl'): void {
  const isLp = tokenType === 'lp'
  const isSplit = readLockMode() === 'split'

  const mintLabel = document.querySelector<HTMLElement>('#tokenMintLabel')
  const mintHint = document.querySelector<HTMLElement>('#tokenMintHint')
  const amountLabel = document.querySelector<HTMLElement>('#amountLabel')
  const amountHint = document.querySelector<HTMLElement>('#amountHint')
  const lpNote = document.querySelector<HTMLElement>('#lpTokenTypeNote')

  if (mintLabel) {
    mintLabel.textContent = isLp ? LP_MINT_LABEL : SPL_MINT_LABEL
  }

  if (mintHint) {
    mintHint.textContent = isLp ? LP_MINT_HINT : SPL_MINT_HINT
  }

  if (amountLabel) {
    if (isSplit) {
      amountLabel.textContent = SPLIT_TOTAL_LABEL
    } else {
      amountLabel.textContent = isLp ? LP_AMOUNT_LABEL : SPL_AMOUNT_LABEL
    }
  }

  if (amountHint) {
    amountHint.textContent = isSplit
      ? SPLIT_TOTAL_HINT
      : isLp
        ? LP_AMOUNT_HINT
        : SPL_AMOUNT_HINT
  }

  if (lpNote) {
    lpNote.hidden = !isLp
  }
}

export function syncCreateLockModeUi(mode: LockMode = readLockMode()): void {
  const isSplit = mode === 'split'
  const singleSection = document.querySelector<HTMLElement>('#singleUnlockSection')
  const splitSection = document.querySelector<HTMLElement>('#splitLockSection')
  const splitWarning = document.querySelector<HTMLElement>('#splitLockWarning')
  const submitButton = document.querySelector<HTMLButtonElement>('#createLockBtn')
  const tokenTypeSelect = document.querySelector<HTMLSelectElement>('#tokenType')

  if (singleSection) {
    singleSection.hidden = isSplit
  }

  if (splitSection) {
    splitSection.hidden = !isSplit
  }

  if (splitWarning) {
    splitWarning.hidden = !isSplit
  }

  if (submitButton) {
    submitButton.textContent = isSplit ? 'Review Split Schedule' : 'Create Lock'
  }

  syncCreateLockTokenTypeUi(
    tokenTypeSelect?.value === 'lp' ? 'lp' : 'spl',
  )
}

export function attachCreateLockTokenTypeUi(): void {
  const select = document.querySelector<HTMLSelectElement>('#tokenType')

  if (!select) {
    return
  }

  const syncFromSelect = () => {
    syncCreateLockTokenTypeUi(select.value === 'lp' ? 'lp' : 'spl')
  }

  syncFromSelect()
  select.addEventListener('change', syncFromSelect)
}

export function attachCreateLockModeUi(onChange?: () => void): void {
  const form = document.querySelector<HTMLFormElement>('#createLockForm')

  form?.querySelectorAll<HTMLInputElement>('input[name="lockMode"]').forEach((input) => {
    input.addEventListener('change', () => {
      syncCreateLockModeUi(readLockMode(form))
      onChange?.()
    })
  })

  syncCreateLockModeUi(readLockMode(form))
}

export function renderCreateLockForm(): string {
  const { date: defaultDate, time: defaultTime, minDate } = getDefaultUnlockDateTime()
  const splitFirst = getDefaultSplitFirstUnlock()

  return `
    <form class="lock-form" id="createLockForm" novalidate>
      <fieldset class="lock-mode-fieldset">
        <legend class="field-label">Lock mode</legend>
        <div class="lock-mode-toggle" role="radiogroup" aria-label="Lock mode">
          <label class="lock-mode-option">
            <input type="radio" name="lockMode" value="single" checked />
            <span>Single Lock</span>
          </label>
          <label class="lock-mode-option">
            <input type="radio" name="lockMode" value="split" />
            <span>Split Lock</span>
          </label>
        </div>
      </fieldset>

      <div class="field-row lock-form-row">
        <label class="field">
          <span class="field-label">Project name</span>
          <input
            class="field-input"
            type="text"
            name="projectName"
            id="projectName"
            required
            maxlength="48"
            placeholder="My project"
          />
          <span class="field-hint">Name shown on the public lock page.</span>
        </label>

        <label class="field">
          <span class="field-label" id="tokenMintLabel">${SPL_MINT_LABEL}</span>
          <input
            class="field-input field-input--mono"
            type="text"
            name="tokenMint"
            id="tokenMint"
            required
            placeholder="Mint address"
            spellcheck="false"
          />
          <span class="field-hint" id="tokenMintHint">${SPL_MINT_HINT}</span>
        </label>
      </div>

      <div class="field-row lock-form-row">
        <label class="field">
          <span class="field-label">Token type</span>
          <select class="field-input field-select" name="tokenType" id="tokenType">
            <option value="spl">SPL Token</option>
            <option value="lp">LP Token</option>
          </select>
          <span class="field-hint">Choose SPL Token or LP Token.</span>
        </label>

        <label class="field field--amount">
          <span class="field-label" id="amountLabel">${SPL_AMOUNT_LABEL}</span>
          <input
            class="field-input"
            type="text"
            inputmode="decimal"
            name="amount"
            id="amount"
            required
            placeholder="1000"
          />
          <div class="amount-shortcuts" data-amount-shortcuts>
            <div class="amount-shortcuts__buttons">
              <button type="button" class="amount-shortcut-btn" data-amount-pct="10">10%</button>
              <button type="button" class="amount-shortcut-btn" data-amount-pct="25">25%</button>
              <button type="button" class="amount-shortcut-btn" data-amount-pct="50">50%</button>
              <button type="button" class="amount-shortcut-btn" data-amount-pct="75">75%</button>
              <button type="button" class="amount-shortcut-btn" data-amount-pct="max">Max</button>
            </div>
            <p class="amount-shortcuts__available" id="amountAvailableBalance" hidden></p>
            <p class="amount-shortcuts__feedback" id="amountShortcutsFeedback" role="status" hidden></p>
          </div>
          <span class="field-hint" id="amountHint">${SPL_AMOUNT_HINT}</span>
        </label>
      </div>

      <div class="compact-info-note compact-info-note--lp" id="lpTokenTypeNote" hidden>
        <p class="compact-info-note__body">
          LP tokens represent a liquidity position. Locking LP tokens can show that liquidity is
          committed until the unlock date.
        </p>
        <p class="compact-info-note__warning">
          LP locking is proof that the LP tokens are locked. It does not guarantee token price,
          pool safety, trading volume or project success.
        </p>
      </div>

      <div class="compact-info-note compact-info-note--split" id="splitLockWarning" hidden>
        <p class="compact-info-note__warning">
          This creates multiple separate locks. Each unlock is independent. You must approve one
          transaction per lock.
        </p>
      </div>

      <div id="singleUnlockSection">
        <div class="field-row unlock-datetime-row">
          <label class="field">
            <span class="field-label">Unlock date</span>
            <input
              class="field-input"
              type="date"
              name="unlockDate"
              id="unlockDate"
              min="${minDate}"
              value="${defaultDate}"
            />
          </label>

          <label class="field">
            <span class="field-label">Unlock time</span>
            <input
              class="field-input"
              type="time"
              name="unlockTime"
              id="unlockTime"
              value="${defaultTime}"
            />
          </label>
        </div>
        <p class="field-hint field-hint--row">Tokens can only be unlocked after this date and time.</p>
      </div>

      <div id="splitLockSection" hidden>
        <div class="field-row lock-form-row">
          <label class="field">
            <span class="field-label">Number of unlocks</span>
            <input
              class="field-input"
              type="number"
              name="splitUnlockCount"
              id="splitUnlockCount"
              min="${SPLIT_LOCK_MIN_UNLOCKS}"
              max="${SPLIT_LOCK_MAX_UNLOCKS}"
              step="1"
              value="5"
            />
            <span class="field-hint">
              Between ${SPLIT_LOCK_MIN_UNLOCKS} and ${SPLIT_LOCK_MAX_UNLOCKS}. Each unlock receives an equal share.
            </span>
          </label>

          <label class="field">
            <span class="field-label">Unlock interval</span>
            <select class="field-input field-select" name="splitInterval" id="splitInterval">
              <option value="monthly">Monthly</option>
              <option value="yearly" selected>Yearly</option>
            </select>
            <span class="field-hint">Time between each unlock date.</span>
          </label>
        </div>

        <div class="field-row unlock-datetime-row">
          <label class="field">
            <span class="field-label">First unlock date</span>
            <input
              class="field-input"
              type="date"
              name="splitFirstUnlockDate"
              id="splitFirstUnlockDate"
              min="${minDate}"
              value="${splitFirst.date}"
            />
          </label>

          <label class="field">
            <span class="field-label">First unlock time</span>
            <input
              class="field-input"
              type="time"
              name="splitFirstUnlockTime"
              id="splitFirstUnlockTime"
              value="${splitFirst.time}"
            />
          </label>
        </div>
        <p class="field-hint field-hint--row">
          Later unlocks are scheduled monthly or yearly from this date.
        </p>
      </div>

      <p class="form-classification-note">
        SPL and LP tokens use the same on-chain vault. The token type you choose is saved as a
        label with your lock.
      </p>

      <label class="checkbox-field">
        <input
          type="checkbox"
          name="safetyAcknowledgement"
          id="safetyAcknowledgement"
          required
        />
        <span>I understand locking improves transparency but does not guarantee project safety.</span>
      </label>

      <div class="form-feedback">
        <div class="success-panel" id="createLockSuccess" role="status" hidden>
          <p class="success-panel__title">Lock created successfully.</p>
          <p class="success-panel__body" id="createLockSuccessBody">
            Your tokens are now held in an on-chain vault until the unlock date.
          </p>
        </div>
        <p class="form-error" id="createLockError" role="alert" hidden></p>
      </div>

      <button type="submit" class="primary-btn" id="createLockBtn">
        Create Lock
      </button>
    </form>
  `
}
