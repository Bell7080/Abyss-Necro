// Full-screen victory veil — the 1st ending. Mirrors DefeatOverlay's language
// but in a warm, triumphant key: the abyss yields, a title surfaces, and the
// only way onward is a fresh run (page reload — no mid-run state survives).
export class VictoryOverlay {
  private readonly overlay: HTMLElement
  private readonly subEl: HTMLElement

  constructor(root: HTMLElement) {
    this.overlay = document.createElement('div')
    this.overlay.className = 'victory-overlay'
    this.overlay.innerHTML = `
      <div class="victory-veil"></div>
      <div class="victory-content">
        <div class="victory-kicker">1차 엔딩</div>
        <div class="victory-title">심연을 다스리다</div>
        <div class="victory-sub"></div>
        <button type="button" class="victory-retry-button">다시 도전하기</button>
      </div>`

    this.subEl = this.overlay.querySelector('.victory-sub') as HTMLElement
    this.overlay
      .querySelector('.victory-retry-button')!
      .addEventListener('click', () => window.location.reload())
    root.appendChild(this.overlay)
  }

  /** `captured` distinguishes the sacral ending (boss claimed as a card) from
   * simply slaying it. */
  show(captured: boolean): void {
    this.subEl.textContent = captured
      ? '심연의 보스를 사령하여 첫 장을 닫았다'
      : '심연의 보스를 처치하고 첫 장을 닫았다'
    // Double rAF so the pre-show state paints before the reveal transition.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.overlay.classList.add('is-visible'))
    })
  }
}
