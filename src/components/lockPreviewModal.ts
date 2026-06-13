import type { PreviewLock } from '../types/lock'
import {
  formatAmount,
  formatDateTime,
  formatTokenType,
  formatWalletAddress,
} from '../utils/format'
import { escapeHtml } from '../utils/html'
import { formatLockStatus, formatRemainingTime, getLockStatus } from '../utils/time'

export function renderLockPreviewModal(preview: PreviewLock): string {
  const status = getLockStatus(preview.unlockAt)

  return `
    <div class="modal-overlay" id="lockPreviewModal" data-lock-preview-modal>
      <div
        class="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lock-preview-heading"
      >
        <p class="mode-badge mode-badge--preview">Preview Mode</p>
        <h2 class="modal-title" id="lock-preview-heading">Lock Preview</h2>
        <p class="modal-lead">
          This preview is not an on-chain lock. Confirm to submit a real on-chain
          lock transaction through your connected wallet.
        </p>

        <dl class="detail-list">
          <div class="detail-item">
            <dt>Project Name</dt>
            <dd>${escapeHtml(preview.projectName)}</dd>
          </div>
          <div class="detail-item">
            <dt>Token Mint</dt>
            <dd class="mono">${escapeHtml(preview.tokenMint)}</dd>
          </div>
          <div class="detail-item">
            <dt>Token Type</dt>
            <dd>${escapeHtml(formatTokenType(preview.tokenType))}</dd>
          </div>
          <div class="detail-item">
            <dt>Amount</dt>
            <dd>${escapeHtml(formatAmount(preview.amount))}</dd>
          </div>
          <div class="detail-item">
            <dt>Wallet Address</dt>
            <dd class="mono">${escapeHtml(formatWalletAddress(preview.lockerWallet, 8))}</dd>
          </div>
          <div class="detail-item">
            <dt>Unlock Date</dt>
            <dd>${escapeHtml(formatDateTime(preview.unlockAt))}</dd>
          </div>
          <div class="detail-item">
            <dt>Remaining Time</dt>
            <dd>${escapeHtml(formatRemainingTime(preview.unlockAt))}</dd>
          </div>
          <div class="detail-item">
            <dt>Preview Status</dt>
            <dd>${escapeHtml(formatLockStatus(status))}</dd>
          </div>
        </dl>

        <div class="modal-actions">
          <button type="button" class="secondary-btn" data-lock-preview-cancel>
            Back
          </button>
          <button type="button" class="primary-btn" data-lock-preview-confirm>
            Create On-chain Lock
          </button>
        </div>
      </div>
    </div>
  `
}
