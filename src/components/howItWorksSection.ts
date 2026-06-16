export function renderHowItWorksSection(): string {
  return `
    <section
      class="info-card how-it-works-card"
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
    >
      <button
        type="button"
        class="how-it-works-card__trigger"
        data-how-it-works-open
        aria-haspopup="dialog"
      >
        <span class="how-it-works-card__content">
          <h2 class="info-card__title" id="how-it-works-heading">How the Token Locker Works</h2>
          <p class="info-card__lead">
            Create a lock, deposit tokens into the vault and unlock them only after the selected unlock date.
          </p>
        </span>
        <span class="secondary-btn how-it-works-card__btn">Learn More</span>
      </button>
    </section>
  `
}
