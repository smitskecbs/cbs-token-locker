function formatLocalDateInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatLocalTimeInput(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${hours}:${minutes}`
}

function getDefaultUnlockDateTime(): { date: string; time: string; minDate: string } {
  const defaultUnlock = new Date(Date.now() + 10 * 60 * 1000)

  return {
    date: formatLocalDateInput(defaultUnlock),
    time: formatLocalTimeInput(defaultUnlock),
    minDate: formatLocalDateInput(new Date()),
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

export function syncCreateLockTokenTypeUi(tokenType: 'spl' | 'lp' = 'spl'): void {
  const isLp = tokenType === 'lp'

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
    amountLabel.textContent = isLp ? LP_AMOUNT_LABEL : SPL_AMOUNT_LABEL
  }

  if (amountHint) {
    amountHint.textContent = isLp ? LP_AMOUNT_HINT : SPL_AMOUNT_HINT
  }

  if (lpNote) {
    lpNote.hidden = !isLp
  }
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

export function renderCreateLockForm(): string {
  const { date: defaultDate, time: defaultTime, minDate } = getDefaultUnlockDateTime()

  return `
    <form class="lock-form" id="createLockForm" novalidate>
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

        <label class="field">
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

      <div class="field-row unlock-datetime-row">
        <label class="field">
          <span class="field-label">Unlock date</span>
          <input
            class="field-input"
            type="date"
            name="unlockDate"
            id="unlockDate"
            required
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
            required
            value="${defaultTime}"
          />
        </label>
      </div>
      <p class="field-hint field-hint--row">Tokens can only be unlocked after this date and time.</p>

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
          <p class="success-panel__body">Your tokens are now held in an on-chain vault until the unlock date.</p>
        </div>
        <p class="form-error" id="createLockError" role="alert" hidden></p>
      </div>

      <button type="submit" class="primary-btn" id="createLockBtn">
        Create Lock
      </button>
    </form>
  `
}
