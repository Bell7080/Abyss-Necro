// Full-screen victory veil — the 1st ending. A translucent dark blur over the
// board (still faintly visible behind), with the cute-toned triumph copy on
// top. Onward is a fresh run (page reload — no mid-run state survives).
export class VictoryOverlay {
  private readonly overlay: HTMLElement

  constructor(root: HTMLElement) {
    this.overlay = document.createElement('div')
    this.overlay.className = 'victory-overlay'
    this.overlay.innerHTML = `
      <div class="victory-veil"></div>
      <div class="victory-content">
        <div class="victory-kicker">승리</div>
        <div class="victory-title">이제 모두 내 친구들이야!</div>
        <div class="victory-sub">오늘 하루 재밌었지?</div>
        <button type="button" class="victory-retry-button">처음으로</button>
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
