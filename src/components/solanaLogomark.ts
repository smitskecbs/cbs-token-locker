export function renderSolanaLogomark(className = 'solana-logomark'): string {
  return `
    <svg
      class="${className}"
      width="18"
      height="14"
      viewBox="0 0 101 88"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient
          id="cbsLockerSolanaGrad"
          x1="8.525"
          y1="90.097"
          x2="88.881"
          y2="-3.011"
          gradientUnits="userSpaceOnUse"
        >
          <stop stop-color="#9945FF" />
          <stop offset="1" stop-color="#14F195" />
        </linearGradient>
      </defs>
      <path
        fill="url(#cbsLockerSolanaGrad)"
        d="M100.48 69.381H86.481L100.48 55.383V69.381ZM63.704 32.606L49.706 46.604V32.606H63.704ZM100.48 32.606L86.481 46.604H100.48V32.606ZM49.706 69.381H35.708L49.706 55.383V69.381ZM14.48 32.606L0.481 46.604V32.606H14.48ZM49.706 32.606L35.708 46.604H49.706V32.606ZM35.708 69.381H21.71L35.708 55.383V69.381ZM86.481 69.381H72.483L86.481 55.383V69.381ZM72.483 32.606L58.485 46.604V32.606H72.483Z"
      />
    </svg>
  `
}
