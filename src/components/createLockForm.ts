import { CBS_LOCKER_PROGRAM_ID } from '../solana/programId'

export function renderCreateLockForm(): string {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const minDate = tomorrow.toISOString().slice(0, 10)

  return `
    <section
      class="page-section"
      id="create-lock"
      aria-labelledby="create-lock-heading"
    >
      <h2 class="section-title" id="create-lock-heading">Create On-chain Lock</h2>
      <form class="panel-card lock-form" id="createLockForm" novalidate>
        <p class="panel-lead">
          Prepare a lock preview first, then submit a real on-chain lock transaction
          to the CBS Token Locker program. Lock accounts and vaults are deterministic
          and publicly verifiable on Solana.
        </p>

        <div class="program-panel">
          <span class="field-label">Program ID</span>
          <p class="mono program-panel__value">${CBS_LOCKER_PROGRAM_ID}</p>
        </div>

        <label class="field">
          <span class="field-label">Project Name</span>
          <input
            class="field-input"
            type="text"
            name="projectName"
            id="projectName"
            required
            maxlength="48"
            placeholder="Stored on-chain (max 48 characters)"
          />
        </label>

        <label class="field">
          <span class="field-label">Token Mint Address</span>
          <input
            class="field-input field-input--mono"
            type="text"
            name="tokenMint"
            id="tokenMint"
            required
            placeholder="SPL or LP token mint address"
            spellcheck="false"
          />
        </label>

        <label class="field">
          <span class="field-label">Token Type</span>
          <select class="field-input field-select" name="tokenType" id="tokenType">
            <option value="spl">SPL Token</option>
            <option value="lp">LP Token</option>
          </select>
        </label>

        <label class="field">
          <span class="field-label">Amount To Lock</span>
          <input
            class="field-input"
            type="text"
            inputmode="decimal"
            name="amount"
            id="amount"
            required
            placeholder="Human-readable token amount"
          />
        </label>

        <div class="field-row">
          <label class="field">
            <span class="field-label">Unlock Date</span>
            <input
              class="field-input"
              type="date"
              name="unlockDate"
              id="unlockDate"
              required
              min="${minDate}"
            />
          </label>

          <label class="field">
            <span class="field-label">Unlock Time</span>
            <input
              class="field-input"
              type="time"
              name="unlockTime"
              id="unlockTime"
              required
              value="12:00"
            />
          </label>
        </div>

        <label class="field">
          <span class="field-label">Optional Project Description</span>
          <textarea
            class="field-input field-textarea"
            name="projectDescription"
            id="projectDescription"
            rows="4"
            maxlength="500"
            placeholder="Preview only. Not stored on-chain in version 1."
          ></textarea>
        </label>

        <label class="checkbox-field">
          <input
            type="checkbox"
            name="safetyAcknowledgement"
            id="safetyAcknowledgement"
            required
          />
          <span>
            I understand that on-chain locking improves transparency but does not
            guarantee project safety.
          </span>
        </label>

        <p class="form-error" id="createLockError" role="alert" hidden></p>
        <p id="createLockSuccess" role="status" hidden></p>

        <button type="submit" class="secondary-btn" id="previewLockBtn">
          Preview Lock
        </button>
        <button type="button" class="primary-btn" id="createLockBtn" disabled>
          Create On-chain Lock
        </button>
      </form>
    </section>
  `
}
