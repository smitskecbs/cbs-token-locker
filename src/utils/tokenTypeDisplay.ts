import type { TokenType } from '../types/lock'
import { escapeHtml } from './html'

export function resolveTokenType(tokenType: TokenType | null | undefined): TokenType {
  if (tokenType === 'lp' || tokenType === 'spl') {
    return tokenType
  }

  return 'unknown'
}

export function formatLockTypeLabel(tokenType: TokenType | null | undefined): string {
  const resolved = resolveTokenType(tokenType)

  if (resolved === 'lp') {
    return 'LP Token'
  }

  if (resolved === 'spl') {
    return 'SPL Token'
  }

  return 'Token'
}

export function formatLockTypeCertificateBadge(tokenType: TokenType | null | undefined): string {
  const resolved = resolveTokenType(tokenType)

  if (resolved === 'lp') {
    return 'LP Token Lock'
  }

  if (resolved === 'spl') {
    return 'SPL Token Lock'
  }

  return 'Token Lock'
}

export function formatTokenTypeBadge(tokenType: TokenType | null | undefined): string {
  const resolved = resolveTokenType(tokenType)

  if (resolved === 'lp') {
    return 'LP'
  }

  if (resolved === 'spl') {
    return 'SPL'
  }

  return 'Token'
}

export function renderTokenTypeBadgeMarkup(
  tokenType: TokenType | null | undefined,
  className = 'token-type-badge',
): string {
  const label = formatTokenTypeBadge(tokenType)
  const modifier =
    tokenType === 'lp'
      ? ' token-type-badge--lp'
      : tokenType === 'spl'
        ? ' token-type-badge--spl'
        : ' token-type-badge--generic'

  return `<span class="${escapeHtml(className)}${modifier}">${escapeHtml(label)}</span>`
}
