export function renderSolanaLogomark(className = 'solana-logomark'): string {
  return `
    <img
      class="${className}"
      src="/assets/solana-logomark.svg"
      width="16"
      height="14"
      alt=""
      aria-hidden="true"
      decoding="async"
    />
  `
}
