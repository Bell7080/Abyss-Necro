import { CREATURES } from '@data/CreatureDefinitions'
import { allyStatsForLevel, enemyStatsForLevel } from '@data/Tiers'
import { Icons } from '@ui/Icons'

// Crab's hard-shell placement bonus mirrors DefenderSystem.CRAB_GUARD_BONUS_HP,
// so the 사령 stat reads what the passive line promises.
const CRAB_GUARD_BONUS_HP = 4

// 도감 — Unmelting's compendium launcher/hover idiom ported to the abyss:
// a flat book icon that lifts and sparkles on hover, opening a translucent
// deep-blue window. Rather than a scroll list, each creature gets its own
// full-slide page (large before/after illustrations + stats), stepped through
// one at a time with the down/up nav or a scroll-snap wheel — "내리면 다음 몹".
// Display-only, no game state touched.
export class CodexOverlay {
  private readonly overlay: HTMLElement
  private readonly modal: HTMLElement
  private readonly track: HTMLElement
  private readonly pages: HTMLElement[]
  private readonly counterEl: HTMLElement
  private readonly upBtn: HTMLButtonElement
  private readonly downBtn: HTMLButtonElement
  private index = 0

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

    this.modal = this.overlay.querySelector('.codex-modal') as HTMLElement
    this.track = this.overlay.querySelector('.codex-body') as HTMLElement
    this.pages = Array.from(this.overlay.querySelectorAll<HTMLElement>('.codex-page'))
    this.counterEl = this.overlay.querySelector('.codex-nav-counter') as HTMLElement
    this.upBtn = this.overlay.querySelector('.codex-nav-up') as HTMLButtonElement
    this.downBtn = this.overlay.querySelector('.codex-nav-down') as HTMLButtonElement

    this.upBtn.addEventListener('click', () => this.goTo(this.index - 1))
    this.downBtn.addEventListener('click', () => this.goTo(this.index + 1))
    // Keep the counter/buttons in sync when the user scroll-snaps by hand.
    this.track.addEventListener('scroll', () => this.syncIndexFromScroll())
    this.updateNav()
  }

  private buildHtml(): string {
    const pages = CREATURES.map((c) => {
      const es = enemyStatsForLevel(c.level)
      const as = allyStatsForLevel(c.level, 1)
      const allyHp = as.hp + (c.passiveId === 'crab-guard' ? CRAB_GUARD_BONUS_HP : 0)
      return `
      <section class="codex-page">
        <div class="codex-pair">
          <article class="codex-figure codex-figure--before">
            ${figureArt(c.enemyArt, c.label)}
            <div class="codex-figure-scrim" aria-hidden="true"></div>
            <div class="codex-figure-info">
              <span class="codex-figure-tag codex-figure-tag--before">적</span>
              <h3 class="codex-figure-name">${c.label}</h3>
              ${statsRow(es.attack, es.hp)}
              <p class="codex-figure-desc">${c.enemyDesc}</p>
            </div>
          </article>
          <div class="codex-transform" aria-hidden="true">
            <span class="codex-transform-icon">${Icons.necroArrow()}</span>
            <span class="codex-transform-word">사령</span>
          </div>
          <article class="codex-figure codex-figure--after">
            ${figureArt(c.allyArt, `${c.label} (사령)`)}
            <div class="codex-figure-scrim" aria-hidden="true"></div>
            <div class="codex-figure-info">
              <span class="codex-figure-tag codex-figure-tag--after">사령</span>
              <h3 class="codex-figure-name">${c.label}</h3>
              ${statsRow(as.attack, allyHp)}
              <p class="codex-figure-desc">${c.passive}</p>
            </div>
          </article>
        </div>
      </section>`
    }).join('')

    return `
      <div class="codex-modal">
        <header class="codex-head">
          <div class="codex-titles">
            <span class="codex-title">심연 도감</span>
            <span class="codex-subtitle">사령 전 · 후 비교</span>
          </div>
          <button type="button" class="codex-close" aria-label="닫기">${Icons.closeMark()}</button>
        </header>
        <div class="codex-body">${pages}</div>
        <div class="codex-nav">
          <button type="button" class="codex-nav-btn codex-nav-up" aria-label="이전">${Icons.chevronDown()}</button>
          <span class="codex-nav-counter">1 / ${CREATURES.length}</span>
          <button type="button" class="codex-nav-btn codex-nav-down" aria-label="다음">${Icons.chevronDown()}</button>
        </div>
      </div>`
  }

  /** Scroll a specific creature-slide into view and refresh the nav state. */
  private goTo(target: number): void {
    const clamped = Math.max(0, Math.min(this.pages.length - 1, target))
    this.index = clamped
    this.track.scrollTo({ top: this.pages[clamped].offsetTop, behavior: 'smooth' })
    this.updateNav()
  }

  /** After a manual wheel/drag scroll-snap, derive which slide is showing. */
  private syncIndexFromScroll(): void {
    const h = this.track.clientHeight || 1
    const next = Math.round(this.track.scrollTop / h)
    if (next !== this.index) {
      this.index = Math.max(0, Math.min(this.pages.length - 1, next))
      this.updateNav()
    }
  }

  private updateNav(): void {
    this.counterEl.textContent = `${this.index + 1} / ${this.pages.length}`
    this.upBtn.disabled = this.index === 0
    this.downBtn.disabled = this.index === this.pages.length - 1
    // Tint the whole window toward the current creature's illustration color.
    this.modal.style.setProperty('--codex-tone', CREATURES[this.index]?.tone ?? 'transparent')
  }

  private open(): void {
    this.overlay.classList.add('is-visible')
    // Always open on the first creature.
    this.track.scrollTop = 0
    this.index = 0
    this.updateNav()
  }

  private close(): void {
    this.overlay.classList.remove('is-visible')
  }
}

/** The full illustration, or a flat watermark placeholder until the art lands. */
function figureArt(url: string | undefined, alt: string): string {
  if (url) return `<img class="codex-figure-art" src="${url}" alt="${alt}" />`
  return `<div class="codex-figure-art codex-figure-art--placeholder" role="img" aria-label="${alt}">${Icons.enemyToken()}</div>`
}

/** Two stat chips (공격 / 체력) — the shared codex stat readout. */
function statsRow(attack: number, hp: number): string {
  return `
    <div class="codex-stats">
      <span class="codex-stat"><span class="codex-stat-key">공격</span><span class="codex-stat-val">${attack}</span></span>
      <span class="codex-stat"><span class="codex-stat-key">체력</span><span class="codex-stat-val">${hp}</span></span>
    </div>`
}
