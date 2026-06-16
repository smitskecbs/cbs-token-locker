export function renderOverviewSection(): string {
  return `
    <section class="info-card overview-card" id="overview" aria-labelledby="overview-heading">
      <h2 class="info-card__title" id="overview-heading">What can you do here?</h2>
      <p class="info-card__lead">
        Use the CBS Token Locker to lock tokens for a fixed time, create public proof of commitment
        and give your community more transparency.
      </p>
      <ul class="info-card__list">
        <li>Lock SPL tokens or LP tokens</li>
        <li>Set an unlock date</li>
        <li>View lock details</li>
        <li>Share public lock proof</li>
        <li>Unlock only after the lock period ends</li>
      </ul>
    </section>
  `
}
