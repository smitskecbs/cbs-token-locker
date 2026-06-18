import { getPublicLockPath } from '../locker'
import type { SplitLockPreview } from '../types/splitLock'
import {
  formatAmount,
  formatDateTime,
  formatTokenType,
  formatWalletAddress,
} from '../utils/format'
import { escapeHtml } from '../utils/html'
import { getLockStatus } from '../utils/time'
import { renderLockStatusMarkup } from '../utils/lockDisplay'

function formatIntervalLabel(interval: SplitLockPreview['interval']): string {
  return interval === 'monthly' ? 'Monthly' : 'Yearly'
}

export function renderSplitLockPreviewModal(preview: SplitLockPreview): string {
  const isLp = preview.tokenType === 'lp'

  return `
    <div class="modal-overlay" id="splitLockPreviewModal" data-split-lock-preview-modal>
      <div
        class="modal-dialog review-lock-dialog split-lock-preview-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="split-lock-preview-heading"
      >
        <h2 class="modal-title" id="split-lock-preview-heading">
          Review split lock schedule
        </h2>
        <p class="modal-lead">
          ${preview.tranches.length} separate locks will be created. You must approve one wallet
          transaction per lock.
        </p>

        <dl class="detail-list">
          <div class="detail-item">
            <dt>Project</dt>
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
            <dt>Total Amount</dt>
            <dd>${escapeHtml(formatAmount(preview.totalAmount))}</dd>
          </div>
          <div class="detail-item">
            <dt>Interval</dt>
            <dd>${escapeHtml(formatIntervalLabel(preview.interval))}</dd>
          </div>
          <div class="detail-item">
            <dt>Wallet</dt>
            <dd class="mono">${escapeHtml(formatWalletAddress(preview.lockerWallet, 8))}</dd>
          </div>
        </dl>

        <div class="split-lock-preview-table-wrap">
          <table class="split-lock-preview-table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Amount</th>
                <th scope="col">Share</th>
                <th scope="col">Unlock date</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              ${preview.tranches
                .map((tranche) => {
                  const status = getLockStatus(tranche.unlockAt)

                  return `
                    <tr>
                      <td>${tranche.index}</td>
                      <td>${escapeHtml(formatAmount(tranche.amount))}</td>
                      <td>${escapeHtml(tranche.percentLabel)}</td>
                      <td>${escapeHtml(formatDateTime(tranche.unlockAt))}</td>
                      <td>${renderLockStatusMarkup(status)}</td>
                    </tr>
                  `
                })
                .join('')}
            </tbody>
          </table>
        </div>

        <p class="compact-info-note__warning split-lock-preview-warning">
          This creates multiple separate locks. Each unlock is independent. You must approve one
          transaction per lock.
        </p>

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
          <button type="button" class="secondary-btn" data-split-lock-preview-cancel>
            Cancel
          </button>
          <button type="button" class="primary-btn" data-split-lock-preview-confirm>
            Create ${preview.tranches.length} Locks
          </button>
        </div>
      </div>
    </div>
  `
}

export function renderSplitLockTrancheLink(lockAccount: string, index: number): string {
  return `
    <a class="lock-link" href="${getPublicLockPath(lockAccount)}" data-router-link>
      Lock ${index}
    </a>
  `
}
