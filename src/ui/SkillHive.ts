import type { AbilitySystem, AbilityId } from '@systems/AbilitySystem'
import { SKILL_FACES, getSkillArt } from '@ui/SkillArt'

// Basic first (always-on default), then the three toggle skills — laid out
// as a honeycomb column beside the player card. Order/names/hints come from
// the shared SKILL_FACES map (same source the cast cut-in panel reads).
const HEX_ORDER: AbilityId[] = ['basic', 'raise', 'raise-all', 'capture']

export interface SkillHiveHandlers {
  /** A hex was pressed. Game decides: basic disarms, raise/capture arm,
   * raise-all fires at once. */
  onSkill: (id: AbilityId) => void
}

// Left-of-player honeycomb of four hex skill buttons with a vertical sacral
// gauge on their inner edge. The gauge fill reads getSmoothGauge() every
// frame (display only) so it creeps between kills/trickle ticks; render()
// updates the whole-number affordable/armed states.
// Gap between the hive's right edge and the player card's left edge, and the
// minimum distance the hive keeps from the screen's left edge (so it never
// falls off-screen when the board hugs the left at narrow window sizes).
const HIVE_CARD_GAP = 8
const HIVE_MIN_LEFT = 10

export class SkillHive {
  private readonly wrap: HTMLElement
  private readonly hexes = new Map<AbilityId, HTMLButtonElement>()
  private readonly gaugeFill: HTMLElement

  constructor(
    root: HTMLElement,
    private readonly ability: AbilitySystem,
    handlers: SkillHiveHandlers
  ) {
    // .skill-hive = transparent perspective frame (matches the board's eye);
    // .hive-plane = the tilted content plane. Splitting them lets the shared
    // vanishing point live on the frame while the tilt/rotate pivot stays on
    // the plane — so the gauge's edges run parallel to the card's (no wedge).
    const wrap = document.createElement('div')
    wrap.className = 'skill-hive'
    this.wrap = wrap
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
      btn.title = face.hint
      btn.style.setProperty('--hex-tone', face.tone)
      if (art) btn.style.setProperty('--hex-art', `url('${art}')`)
      btn.innerHTML = `<span class="hex-face" aria-hidden="true"><span class="hex-art-scrim" aria-hidden="true"></span></span><span class="hex-name">${face.name}</span><span class="hex-cost">${this.ability.costOf(id)}</span>`
      btn.addEventListener('click', () => handlers.onSkill(id))
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
    root.appendChild(wrap)

    const tick = (): void => {
      const ratio = this.ability.getSmoothGauge() / this.ability.getMaxGauge()
      this.gaugeFill.style.height = `${ratio * 100}%`
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  /** Welds the hive to the player card's live position, sitting just to the LEFT
   * of the card (beside it, not overlapping its face) and vertically centered on
   * it. Clamped so it never slides off the screen's left edge. Call after layout
   * and on resize; skip during cast animations so it anchors to the card at rest.
   *
   * `boardMountRect`, if given, re-derives perspective-origin from board-mount's
   * OWN actual eye (its `perspective-origin: 50% -14%`, in live viewport
   * coordinates) relative to wherever the hive just got anchored — sharing the
   * board's vanishing point exactly, not just at one assumed screen position.
   * Without it the hive keeps its last (or CSS-default) perspective-origin. */
  anchorTo(cardRect: DOMRect | null, boardMountRect?: DOMRect | null): void {
    if (!cardRect) return
    const w = this.wrap.offsetWidth || 112
    const h = this.wrap.offsetHeight || 320
    const left = Math.max(HIVE_MIN_LEFT, cardRect.left - w - HIVE_CARD_GAP)
    const top = cardRect.top + (cardRect.height - h) / 2
    this.wrap.style.left = `${Math.round(left)}px`
    this.wrap.style.top = `${Math.round(top)}px`

    if (boardMountRect) {
      const eyeX = boardMountRect.left + boardMountRect.width * 0.5
      const eyeY = boardMountRect.top + boardMountRect.height * -0.14
      this.wrap.style.perspectiveOrigin = `${Math.round(eyeX - left)}px ${Math.round(eyeY - top)}px`
    }
  }

  /** Highlights the currently armed toggle skill (null = plain basic mode). */
  setArmed(id: AbilityId | null): void {
    for (const [aid, btn] of this.hexes) btn.classList.toggle('is-armed', aid === id)
  }

  render(): void {
    for (const [aid, btn] of this.hexes) {
      const can = this.ability.canCast(aid)
      btn.classList.toggle('is-disabled', !can)
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
