import type { TokenType } from '../types/lock'
import { escapeHtml } from './html'

export function resolveTokenType(tokenType: TokenType | null | undefined): TokenType {
  if (tokenType === 'lp' || tokenType === 'spl' || tokenType === 'clmm') {
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

  if (resolved === 'clmm') {
    return 'CLMM Position'
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

  if (resolved === 'clmm') {
    return 'CLMM Position Lock'
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

  if (resolved === 'clmm') {
    return 'CLMM'
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
        : tokenType === 'clmm'
          ? ' token-type-badge--clmm'
          : ' token-type-badge--generic'

  return `<span class="${escapeHtml(className)}${modifier}">${escapeHtml(label)}</span>`
}
