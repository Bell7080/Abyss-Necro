const REVEAL_DELAY_MS = 150
// Must match .intro-black-veil's transition duration in board.css.
const REVEAL_DURATION_MS = 2800
const DISMISS_MS = 600

// Full-screen title scene shown once at boot: a completely black screen fades
// in over the title art (bg_002) — rippling caustics + a heavy vignette sell
// the deep-sea mood. Only once fully revealed does `onRevealed` fire (the OST
// starts here, not before), and a blinking click-to-start prompt invites the
// player to actually start the run — no enemies move or spawn until they
// click through (see Game.startRun()).
export class IntroOverlay {
  private readonly overlay: HTMLElement

  constructor(root: HTMLElement, onStart: () => void, onRevealed: () => void) {
    this.overlay = document.createElement('div')
    this.overlay.className = 'intro-overlay'
    this.overlay.innerHTML = `
      <div class="intro-title-bg"></div>
      <div class="abyss-caustic abyss-caustic--a"></div>
      <div class="abyss-caustic abyss-caustic--b"></div>
      <div class="abyss-caustic abyss-caustic--c"></div>
      <div class="intro-title-vignette"></div>
      <div class="intro-black-veil"></div>
      <div class="intro-prompt">화면을 눌러 심해의 친구들을 사귀러 떠나기!</div>`
    root.appendChild(this.overlay)

    const dismiss = (): void => {
      this.overlay.removeEventListener('click', dismiss)
      this.overlay.classList.add('is-dismissed')
      window.setTimeout(() => this.overlay.remove(), DISMISS_MS)
      onStart()
    }
    this.overlay.addEventListener('click', dismiss)

    // Two rAFs so the fully-dark first frame actually paints before the
    // brighten transition kicks in, instead of the browser coalescing it away.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.setTimeout(() => this.overlay.classList.add('is-revealed'), REVEAL_DELAY_MS)
        window.setTimeout(() => {
          this.overlay.classList.add('is-prompt-visible')
          onRevealed()
        }, REVEAL_DELAY_MS + REVEAL_DURATION_MS)
      })
    })
  }
}
