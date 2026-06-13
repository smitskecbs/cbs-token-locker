export function renderDevnetTestSection(): string {
  return `
    <section
      class="page-section"
      id="devnet-test-mode"
      aria-labelledby="devnet-test-heading"
    >
      <h2 class="section-title" id="devnet-test-heading">Devnet Test Mode</h2>
      <div class="panel-card">
        <p class="panel-lead">
          Use devnet for local end-to-end testing before any mainnet deployment.
        </p>
        <ol class="devnet-steps">
          <li>Deploy the CBS Locker Program to devnet with Anchor.</li>
          <li>Switch the cluster selector above to <strong>Devnet</strong>.</li>
          <li>Use a wallet funded with devnet SOL.</li>
          <li>Create or obtain a devnet SPL token mint and fund your wallet token account.</li>
          <li>Connect the wallet, preview the lock, then submit a real on-chain lock.</li>
          <li>Open the public lock page and confirm on-chain verification passes.</li>
        </ol>
        <p class="devnet-note">
          See <code>docs/DEVNET_TESTING.md</code> for exact commands and the full checklist.
        </p>
      </div>
    </section>
  `
}
