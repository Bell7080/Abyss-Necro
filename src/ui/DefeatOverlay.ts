// Full-screen defeat veil, mirroring the intro overlay's language in
// reverse: the abyss closes back over the board, a title surfaces, and the
// only way out is a fresh run (page reload — no mid-run state survives).
export class DefeatOverlay {
  private readonly overlay: HTMLElement
  private readonly waveEl: HTMLElement

  constructor(root: HTMLElement) {
    this.overlay = document.createElement('div')
    this.overlay.className = 'defeat-overlay'
    this.overlay.innerHTML = `
      <div class="defeat-veil"></div>
      <div class="defeat-content">
        <div class="defeat-kicker">패배</div>
        <div class="defeat-title">심연에 잠기다</div>
        <div class="defeat-wave"></div>
        <button type="button" class="defeat-retry-button">다시 도전하기</button>
      </div>`

    this.waveEl = this.overlay.querySelector('.defeat-wave') as HTMLElement
    this.overlay
      .querySelector('.defeat-retry-button')!
      .addEventListener('click', () => window.location.reload())
    root.appendChild(this.overlay)
  }

  show(waveNumber: number): void {
    this.waveEl.textContent = `웨이브 ${waveNumber}에서 스러졌다`
    // Double rAF so the pre-show state paints before the reveal transition.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.overlay.classList.add('is-visible'))
    })
  }
}
