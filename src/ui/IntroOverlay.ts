const REVEAL_DELAY_MS = 150
// Must match .intro-black-veil's transition duration in board.css.
const REVEAL_DURATION_MS = 2800
// Leaving: the screen cuts back to black first (must match .is-leaving's
// veil transition)...
const LEAVE_FADE_MS = 700
// ...then it fades back out onto the (still idle) board — must match
// .is-entering's transition.
const ENTER_FADE_MS = 900
// Firefly count and how much of the screen's lower band they scatter across
// ("물결 아래" — beneath/among the water ripple, not up near the title art).
const FIREFLY_COUNT = 16

/** A scatter of tiny drifting, twinkling motes across the title screen's
 * lower band — each carries its own size/duration/delay/drift as inline
 * custom properties so the CSS keyframe stays one shared rule. */
function firefliesHtml(): string {
  return Array.from({ length: FIREFLY_COUNT }, () => {
    const left = Math.random() * 100
    const top = 42 + Math.random() * 54
    const size = 2 + Math.random() * 2.2
    const duration = 6 + Math.random() * 7
    const delay = Math.random() * 9
    const drift = -36 + Math.random() * 72
    return `<span class="intro-firefly" style="left:${left.toFixed(1)}%;top:${top.toFixed(1)}%;--firefly-size:${size.toFixed(1)}px;--firefly-duration:${duration.toFixed(1)}s;--firefly-delay:${delay.toFixed(1)}s;--firefly-drift:${drift.toFixed(0)}px"></span>`
  }).join('')
}

// Full-screen title scene shown once at boot: a completely black screen fades
// in over the title art (bg_002) — rippling caustics + a heavy vignette sell
// the deep-sea mood. Only once fully revealed does `onRevealed` fire (the OST
// starts here, not before), and a blinking click-to-start prompt invites the
// player onward. Clicking plays like a scene cut: the screen cuts to black
// (onDismiss fires here, for the OST's stutter-cut), then fades back out onto
// the now-visible-but-still-idle board — once that fade finishes, this overlay
// removes itself and fires `onBoardRevealed`, which Game hands off to
// IntroDialogue (넥슈's opening cutscene). No enemies move or spawn until that
// cutscene's own countdown finishes (see Game.startRun()) — there is no
// "시작하기" button anymore, the dialogue is what starts the run.
export class IntroOverlay {
  private readonly overlay: HTMLElement

  constructor(
    root: HTMLElement,
    onBoardRevealed: () => void,
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
      <div class="intro-fireflies" aria-hidden="true">${firefliesHtml()}</div>
      <div class="intro-black-veil"></div>
      <div class="intro-prompt">화면을 눌러 심해의 친구들을 사귀러 떠나기!</div>`
    root.appendChild(this.overlay)

    const dismissTitle = (): void => {
      this.overlay.removeEventListener('click', dismissTitle)
      this.overlay.classList.remove('is-prompt-visible')
      this.overlay.classList.add('is-leaving')
      onDismiss()
      window.setTimeout(() => {
        this.overlay.classList.remove('is-leaving')
        this.overlay.classList.add('is-entering')
        window.setTimeout(() => {
          this.overlay.remove()
          onBoardRevealed()
        }, ENTER_FADE_MS)
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
