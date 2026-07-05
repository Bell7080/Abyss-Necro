const REVEAL_DELAY_MS = 150
// Must match .intro-black-veil's transition duration in board.css.
const REVEAL_DURATION_MS = 2800
// Leaving: the screen cuts back to black first (must match .is-leaving's
// veil transition)...
const LEAVE_FADE_MS = 700
// ...then it fades back out onto the (still idle) board — must match
// .is-entering's transition.
const ENTER_FADE_MS = 900
const DISMISS_MS = 500

// Full-screen title scene shown once at boot: a completely black screen fades
// in over the title art (bg_002) — rippling caustics + a heavy vignette sell
// the deep-sea mood. Only once fully revealed does `onRevealed` fire (the OST
// starts here, not before), and a blinking click-to-start prompt invites the
// player onward. Clicking plays like a scene cut: the screen cuts to black
// (onDismiss fires here, for the OST's stutter-cut), then fades back out onto
// the now-visible-but-still-idle board with its own "시작하기" button — only
// pressing THAT actually calls onStart(). No enemies move or spawn before
// that (see Game.startRun()).
export class IntroOverlay {
  private readonly overlay: HTMLElement

  constructor(
    root: HTMLElement,
    onStart: () => void,
    onRevealed: () => void,
    onDismiss: () => void
  ) {
    this.overlay = document.createElement('div')
    this.overlay.className = 'intro-overlay'
    this.overlay.innerHTML = `
      <div class="intro-title-bg"></div>
      <div class="abyss-caustic abyss-caustic--a"></div>
      <div class="abyss-caustic abyss-caustic--b"></div>
      <div class="abyss-caustic abyss-caustic--c"></div>
      <div class="intro-title-vignette"></div>
      <div class="intro-black-veil"></div>
      <div class="intro-prompt">화면을 눌러 심해의 친구들을 사귀러 떠나기!</div>
      <div class="intro-start-invite"><button type="button" class="intro-start-button">시작하기</button></div>`
    root.appendChild(this.overlay)

    const startButton = this.overlay.querySelector('.intro-start-button') as HTMLButtonElement
    startButton.addEventListener('click', (e) => {
      e.stopPropagation()
      this.overlay.classList.add('is-dismissed')
      window.setTimeout(() => this.overlay.remove(), DISMISS_MS)
      onStart()
    })

    const dismissTitle = (): void => {
      this.overlay.removeEventListener('click', dismissTitle)
      this.overlay.classList.remove('is-prompt-visible')
      this.overlay.classList.add('is-leaving')
      onDismiss()
      window.setTimeout(() => {
        this.overlay.classList.remove('is-leaving')
        this.overlay.classList.add('is-entering')
        window.setTimeout(() => this.overlay.classList.add('is-awaiting-start'), ENTER_FADE_MS)
      }, LEAVE_FADE_MS)
    }
    this.overlay.addEventListener('click', dismissTitle)

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
