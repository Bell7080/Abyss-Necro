import { CREATURES } from '@data/CreatureDefinitions'
import { Icons } from '@ui/Icons'

// 도감 — Unmelting's compendium launcher/hover idiom ported to the abyss:
// a flat book icon that lifts and sparkles on hover, opening a translucent
// deep-blue window that pairs each creature's before(enemy)/after(necromanced
// ally) illustration and description. This is the portfolio's before/after
// axis made browsable; display-only, no game state touched.
export class CodexOverlay {
  private readonly overlay: HTMLElement

  constructor(shell: HTMLElement) {
    const launcher = document.createElement('button')
    launcher.type = 'button'
    launcher.className = 'codex-launcher'
    launcher.innerHTML = `
      <span class="codex-launcher-icon">${Icons.book()}</span>
      <span class="codex-launcher-label">도감</span>`
    launcher.addEventListener('click', () => this.open())
    shell.appendChild(launcher)

    this.overlay = document.createElement('div')
    this.overlay.className = 'codex-overlay'
    this.overlay.innerHTML = this.buildHtml()
    // Click the backdrop (not the modal) to dismiss.
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close()
    })
    this.overlay.querySelector('.codex-close')?.addEventListener('click', () => this.close())
    document.body.appendChild(this.overlay)
  }

  private buildHtml(): string {
    const entries = CREATURES.map(
      (c) => `
      <article class="codex-entry">
        <div class="codex-side codex-side--before">
          <div class="codex-art"><img src="${c.enemyArt}" alt="${c.label}" /></div>
          <span class="codex-side-tag codex-side-tag--before">적</span>
          <span class="codex-side-name">${c.label}</span>
          <p class="codex-side-desc">${c.enemyDesc}</p>
        </div>
        <div class="codex-arrow" aria-hidden="true">
          <span class="codex-arrow-icon">${Icons.necroArrow()}</span>
          <span class="codex-arrow-word">사령</span>
        </div>
        <div class="codex-side codex-side--after">
          <div class="codex-art"><img src="${c.allyArt}" alt="${c.label} (사령)" /></div>
          <span class="codex-side-tag codex-side-tag--after">사령</span>
          <span class="codex-side-name">${c.label}</span>
          <p class="codex-side-desc">${c.passive}</p>
        </div>
      </article>`
    ).join('')

    return `
      <div class="codex-modal">
        <header class="codex-head">
          <div class="codex-titles">
            <span class="codex-title">심연 도감</span>
            <span class="codex-subtitle">사령 전 · 후 비교</span>
          </div>
          <button type="button" class="codex-close" aria-label="닫기">${Icons.closeMark()}</button>
        </header>
        <div class="codex-body">${entries}</div>
      </div>`
  }

  private open(): void {
    this.overlay.classList.add('is-visible')
  }

  private close(): void {
    this.overlay.classList.remove('is-visible')
  }
}
