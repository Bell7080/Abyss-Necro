// Full-screen defeat veil — a translucent dark blur laid over the board (the
// field stays faintly visible behind), with the cute-toned failure copy on top.
// The only way out is a fresh run (page reload — no mid-run state survives).
export class DefeatOverlay {
  private readonly overlay: HTMLElement

  constructor(root: HTMLElement) {
    this.overlay = document.createElement('div')
    this.overlay.className = 'defeat-overlay'
    this.overlay.innerHTML = `
      <div class="defeat-veil"></div>
      <div class="defeat-content">
        <div class="defeat-kicker">패배</div>
        <div class="defeat-title">심해는 무서워!</div>
        <div class="defeat-sub">다음에 다시 올래.</div>
        <button type="button" class="defeat-retry-button">다시하기</button>
      </div>`

    this.overlay
      .querySelector('.defeat-retry-button')!
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
