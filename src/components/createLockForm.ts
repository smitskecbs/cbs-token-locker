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
        </label>

        <label class="field">
          <span class="field-label">Token mint</span>
          <input
            class="field-input field-input--mono"
            type="text"
            name="tokenMint"
            id="tokenMint"
            required
            placeholder="Mint address"
            spellcheck="false"
          />
        </label>
      </div>

      <div class="field-row lock-form-row">
        <label class="field">
          <span class="field-label">Token type</span>
          <select class="field-input field-select" name="tokenType" id="tokenType">
            <option value="spl">SPL Token</option>
            <option value="lp">LP Token</option>
          </select>
        </label>

        <label class="field">
          <span class="field-label">Amount</span>
          <input
            class="field-input"
            type="text"
            inputmode="decimal"
            name="amount"
            id="amount"
            required
            placeholder="1000"
          />
        </label>
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
