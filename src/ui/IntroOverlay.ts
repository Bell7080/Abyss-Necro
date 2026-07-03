const LIGHT_DELAY_MS = 120
const BUTTON_DELAY_MS = 900
const DISMISS_MS = 520

// Full-screen boot veil: a dark vignette that slowly brightens (clears) to
// reveal the already-rendered (but not yet running) board underneath, then
// invites the player to actually start the run — no enemies move or spawn
// until they click through (see Game.startRun()).
export class IntroOverlay {
  private readonly overlay: HTMLElement
  private readonly button: HTMLButtonElement

  constructor(root: HTMLElement, onStart: () => void) {
    this.overlay = document.createElement('div')
    this.overlay.className = 'intro-overlay'

    const veil = document.createElement('div')
    veil.className = 'intro-veil'

    // Flavor line + oversized button enter together as one centerpiece —
    // the moment of stepping into the abyss, not a mere UI confirm.
    const invite = document.createElement('div')
    invite.className = 'intro-invite'

    const caption = document.createElement('div')
    caption.className = 'intro-caption'
    caption.textContent = '심연이 그대를 기다린다'

    this.button = document.createElement('button')
    this.button.type = 'button'
    this.button.className = 'intro-start-button'
    this.button.textContent = '시작하기'
    this.button.addEventListener('click', () => {
      this.dismiss()
      onStart()
    })

    invite.appendChild(caption)
    invite.appendChild(this.button)
    this.overlay.appendChild(veil)
    this.overlay.appendChild(invite)
    root.appendChild(this.overlay)

    // Two rAFs so the fully-dark first frame actually paints before the
    // brighten transition kicks in, instead of the browser coalescing it away.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.setTimeout(() => this.overlay.classList.add('is-lit'), LIGHT_DELAY_MS)
        window.setTimeout(() => this.overlay.classList.add('is-button-visible'), BUTTON_DELAY_MS)
      })
    })
  }

  private dismiss(): void {
    this.overlay.classList.add('is-dismissed')
    window.setTimeout(() => this.overlay.remove(), DISMISS_MS)
  }
}
