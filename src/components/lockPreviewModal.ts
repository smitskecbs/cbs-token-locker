import type { PreviewLock } from '../types/lock'
import {
  formatAmount,
  formatDateTime,
  formatTokenType,
  formatWalletAddress,
} from '../utils/format'
import { escapeHtml } from '../utils/html'
import { getLockStatus } from '../utils/time'
import { renderLockStatusMarkup } from '../utils/lockDisplay'

export function renderLockPreviewModal(preview: PreviewLock): string {
  const status = getLockStatus(preview.unlockAt)
  const isLp = preview.tokenType === 'lp'

  return `
    <div class="modal-overlay" id="lockPreviewModal" data-lock-preview-modal>
      <div
        class="modal-dialog review-lock-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lock-preview-heading"
      >
        <h2 class="modal-title" id="lock-preview-heading">Review lock</h2>
        <p class="modal-lead">
          Confirm these details, then approve in your wallet.
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
            <dt>Lock Type</dt>
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
            <dt>Status After Lock</dt>
            <dd>${renderLockStatusMarkup(status)}</dd>
          </div>
        </dl>

        ${
          isLp
            ? `
              <p class="preview-lp-note">
                Make sure this is the LP token mint from your wallet, not one of the pool tokens or
                the pool address.
              </p>
            `
            : ''
        }

        <div class="modal-actions">
          <button type="button" class="secondary-btn" data-lock-preview-cancel>
            Cancel
          </button>
          <button type="button" class="primary-btn" data-lock-preview-confirm>
            Create Lock
          </button>
        </div>
      </div>
    </div>
  `
}
