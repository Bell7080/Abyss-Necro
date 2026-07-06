// Full-screen victory veil — the 1st ending. Rises OVER 넥슈's farewell
// dialogue (IntroDialogue 'ending' mode) as a translucent dark blur, with the
// cute-toned triumph copy on top. Onward is a fresh run (page reload — no
// mid-run state survives); the button copy is a wink, not a label.
export class VictoryOverlay {
  private readonly overlay: HTMLElement

  constructor(root: HTMLElement) {
    this.overlay = document.createElement('div')
    this.overlay.className = 'victory-overlay'
    this.overlay.innerHTML = `
      <div class="victory-veil"></div>
      <div class="victory-content">
        <div class="victory-kicker">승리</div>
        <div class="victory-title">모두와 친구가 됐어!</div>
        <button type="button" class="victory-retry-button">(다음에도 기대해줘)</button>
      </div>`

    this.overlay
      .querySelector('.victory-retry-button')!
      .addEventListener('click', () => window.location.reload())
    root.appendChild(this.overlay)
  }

  show(): void {
    // Double rAF so the pre-show state paints before the reveal transition.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.overlay.classList.add('is-visible'))
    })
  }
}
