import type { AbilitySystem, AbilityId } from '@systems/AbilitySystem'
import { SKILL_FACES, getSkillArt } from '@ui/SkillArt'

// Basic first (always-on default), then the three toggle skills — laid out
// left-to-right. Order/names/hints come from the shared SKILL_FACES map
// (same source the cast cut-in panel reads).
const HEX_ORDER: AbilityId[] = ['basic', 'raise', 'raise-all', 'capture']

export interface SkillHiveHandlers {
  /** A hex was pressed. Game decides: basic disarms, raise/capture arm,
   * raise-all fires at once. */
  onSkill: (id: AbilityId) => void
}

// A row of four hex skill buttons fixed top-center (below the wave/timer
// readout — screen-center reads more clearly than tucked beside the player
// card) with a horizontal sacral gauge underneath. The gauge fill reads
// getSmoothGauge() every frame (display only) so it creeps between kills/
// trickle ticks; render() updates the whole-number affordable/armed states.
export class SkillHive {
  private readonly hexes = new Map<AbilityId, HTMLButtonElement>()
  private readonly gaugeFill: HTMLElement
  private readonly tooltip: HTMLElement
  private readonly tooltipName: HTMLElement
  private readonly tooltipHint: HTMLElement
  private readonly tooltipCost: HTMLElement

  constructor(
    root: HTMLElement,
    private readonly ability: AbilitySystem,
    handlers: SkillHiveHandlers
  ) {
    const wrap = document.createElement('div')
    wrap.className = 'skill-hive'
    const plane = document.createElement('div')
    plane.className = 'hive-plane'

    const hexes = document.createElement('div')
    hexes.className = 'hive-hexes'
    for (const id of HEX_ORDER) {
      const face = SKILL_FACES[id]
      const art = getSkillArt(id)
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = `skill-hex skill-hex--${id}${art ? ' has-art' : ''}`
      btn.style.setProperty('--hex-tone', face.tone)
      if (art) btn.style.setProperty('--hex-art', `url('${art}')`)
      btn.innerHTML = `<span class="hex-face" aria-hidden="true"><span class="hex-art-scrim" aria-hidden="true"></span></span><span class="hex-name">${face.name}</span><span class="hex-cost">${this.ability.costOf(id)}</span>`
      btn.addEventListener('click', () => handlers.onSkill(id))
      // Custom themed panel to the right of the hive replaces the browser's
      // native title tooltip — instant, and matches the rest of the UI.
      btn.addEventListener('mouseenter', () => this.showTooltip(id))
      btn.addEventListener('mouseleave', () => this.hideTooltip())
      hexes.appendChild(btn)
      this.hexes.set(id, btn)
    }

    const gauge = document.createElement('div')
    gauge.className = 'hive-gauge'
    gauge.innerHTML = `
      <div class="hive-gauge-track">
        <div class="hive-gauge-fill"></div>
        <div class="hive-gauge-ticks"></div>
      </div>`
    this.gaugeFill = gauge.querySelector('.hive-gauge-fill') as HTMLElement

    plane.appendChild(hexes)
    plane.appendChild(gauge)
    wrap.appendChild(plane)

    const tooltip = document.createElement('div')
    tooltip.className = 'hive-tooltip'
    tooltip.setAttribute('aria-hidden', 'true')
    tooltip.innerHTML = `
      <span class="hive-tooltip-name"></span>
      <span class="hive-tooltip-hint"></span>
      <span class="hive-tooltip-cost"></span>`
    this.tooltip = tooltip
    this.tooltipName = tooltip.querySelector('.hive-tooltip-name') as HTMLElement
    this.tooltipHint = tooltip.querySelector('.hive-tooltip-hint') as HTMLElement
    this.tooltipCost = tooltip.querySelector('.hive-tooltip-cost') as HTMLElement
    wrap.appendChild(tooltip)

    root.appendChild(wrap)

    const tick = (): void => {
      const ratio = this.ability.getSmoothGauge() / this.ability.getMaxGauge()
      this.gaugeFill.style.width = `${ratio * 100}%`
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  /** Fills and reveals the right-side info panel for a hovered hex — name,
   * catchphrase, and gauge cost. */
  private showTooltip(id: AbilityId): void {
    const face = SKILL_FACES[id]
    this.tooltipName.textContent = face.name
    this.tooltipHint.textContent = face.hint
    this.tooltipCost.textContent = `게이지 ${this.ability.costOf(id)}`
    this.tooltip.style.setProperty('--tooltip-tone', face.tone)
    this.tooltip.classList.add('is-visible')
  }

  private hideTooltip(): void {
    this.tooltip.classList.remove('is-visible')
  }

  /** Highlights the currently armed toggle skill (null = plain basic mode). */
  setArmed(id: AbilityId | null): void {
    for (const [aid, btn] of this.hexes) {
      const armed = aid === id
      btn.classList.toggle('is-armed', armed)
      // Arming raise-all/capture should suppress their afterimage pulse right
      // away (armed already reads via scale + hotter glow) instead of waiting
      // for the next gauge-driven render().
      if (aid === 'raise-all' || aid === 'capture') {
        btn.classList.toggle('is-primed', !armed && this.ability.canCast(aid))
      }
    }
  }

  /** One-shot "just fired" flash for a skill cast via a board/corpse click
   * rather than pressing the hex itself (기본공격/급조) — otherwise nothing on
   * the hive shows that the click actually triggered that skill. Reuses the
   * ready-pop enlarge+glow keyframes. */
  flashCast(id: AbilityId): void {
    const btn = this.hexes.get(id)
    if (!btn) return
    btn.classList.remove('is-cast-flash')
    void btn.offsetWidth // restart the keyframe
    btn.classList.add('is-cast-flash')
    window.setTimeout(() => btn.classList.remove('is-cast-flash'), 520)
  }

  render(): void {
    for (const [aid, btn] of this.hexes) {
      const can = this.ability.canCast(aid)
      btn.classList.toggle('is-disabled', !can)
      // Raise-all/capture (the two rarest, highest-impact casts) carry an
      // ongoing pulsing afterimage the whole time they're affordable, not
      // just a one-shot pop — see .is-primed in board.css.
      if (aid === 'raise-all' || aid === 'capture') {
        btn.classList.toggle('is-primed', can && !btn.classList.contains('is-armed'))
      }
      // "팅!" — when a skill first becomes affordable, pop + flash it.
      if (this.prevAffordable.get(aid) === false && can) {
        btn.classList.remove('is-ready-pop')
        void btn.offsetWidth // restart the keyframe
        btn.classList.add('is-ready-pop')
        window.setTimeout(() => btn.classList.remove('is-ready-pop'), 520)
      }
      this.prevAffordable.set(aid, can)
    }
  }

  private readonly prevAffordable = new Map<AbilityId, boolean>()
}
