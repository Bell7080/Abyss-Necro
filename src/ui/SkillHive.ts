import type { AbilitySystem, AbilityId } from '@systems/AbilitySystem'

interface HexDef {
  id: AbilityId
  name: string
  hint: string
}

// Basic first (always-on default), then the three toggle skills — laid out
// as a honeycomb column beside the player card.
const HEXES: HexDef[] = [
  { id: 'basic', name: '공격', hint: '이거나 먹어라!' },
  { id: 'raise', name: '급조', hint: '얘들아…! 막아!' },
  { id: 'raise-all', name: '기상', hint: '모두 일어나!' },
  { id: 'capture', name: '포획', hint: '넌 내꺼야!' },
]

export interface SkillHiveHandlers {
  /** A hex was pressed. Game decides: basic disarms, raise/capture arm,
   * raise-all fires at once. */
  onSkill: (id: AbilityId) => void
}

// Left-of-player honeycomb of four hex skill buttons with a vertical sacral
// gauge on their inner edge. The gauge fill reads getSmoothGauge() every
// frame (display only) so it creeps between kills/trickle ticks; render()
// updates the whole-number affordable/armed states.
export class SkillHive {
  private readonly hexes = new Map<AbilityId, HTMLButtonElement>()
  private readonly gaugeFill: HTMLElement

  constructor(
    root: HTMLElement,
    private readonly ability: AbilitySystem,
    handlers: SkillHiveHandlers
  ) {
    const wrap = document.createElement('div')
    wrap.className = 'skill-hive'

    const hexes = document.createElement('div')
    hexes.className = 'hive-hexes'
    for (const def of HEXES) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = `skill-hex skill-hex--${def.id}`
      btn.title = def.hint
      btn.innerHTML = `<span class="hex-name">${def.name}</span><span class="hex-cost">${this.ability.costOf(def.id)}</span>`
      btn.addEventListener('click', () => handlers.onSkill(def.id))
      hexes.appendChild(btn)
      this.hexes.set(def.id, btn)
    }

    const gauge = document.createElement('div')
    gauge.className = 'hive-gauge'
    gauge.innerHTML = `
      <div class="hive-gauge-track">
        <div class="hive-gauge-fill"></div>
        <div class="hive-gauge-ticks"></div>
      </div>`
    this.gaugeFill = gauge.querySelector('.hive-gauge-fill') as HTMLElement

    wrap.appendChild(hexes)
    wrap.appendChild(gauge)
    root.appendChild(wrap)

    const tick = (): void => {
      const ratio = this.ability.getSmoothGauge() / this.ability.getMaxGauge()
      this.gaugeFill.style.height = `${ratio * 100}%`
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  /** Highlights the currently armed toggle skill (null = plain basic mode). */
  setArmed(id: AbilityId | null): void {
    for (const [aid, btn] of this.hexes) btn.classList.toggle('is-armed', aid === id)
  }

  render(): void {
    for (const [aid, btn] of this.hexes) {
      btn.classList.toggle('is-disabled', !this.ability.canCast(aid))
    }
  }
}
