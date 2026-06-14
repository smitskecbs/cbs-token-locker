export function renderDevnetTestSection(options?: { embedded?: boolean }): string {
  const embedded = options?.embedded === true
  const heading = embedded
    ? `<h3 class="technical-details__heading">Devnet Testing</h3>`
    : `<h2 class="section-title" id="devnet-test-heading">Devnet Test Mode</h2>`

  const body = `
    <div class="panel-card">
      <p class="panel-lead">
        Use devnet for local end-to-end testing before any mainnet deployment.
      </p>
      <ol class="devnet-steps">
        <li>Deploy the CBS Locker Program to devnet with Anchor.</li>
        <li>Switch the cluster selector to <strong>Devnet</strong>.</li>
        <li>Use a wallet funded with devnet SOL.</li>
        <li>Create or obtain a devnet SPL token mint and fund your wallet token account.</li>
        <li>Connect the wallet, create a lock, and confirm on-chain verification.</li>
        <li>Open the public lock page and confirm the certificate details.</li>
      </ol>
      <p class="devnet-note">
        See <code>docs/DEVNET_TESTING.md</code> for exact commands and the full checklist.
      </p>
    </div>
  `

  if (embedded) {
    return `<div class="technical-details__block">${heading}${body}</div>`
  }

  return `
    <section
      class="page-section"
      id="devnet-test-mode"
      aria-labelledby="devnet-test-heading"
    >
      ${heading}
      ${body}
    </section>
  `
}
