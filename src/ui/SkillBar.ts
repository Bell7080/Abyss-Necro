import type { AbilitySystem } from '@systems/AbilitySystem'
import { BASIC_ATTACK_COST, ULTIMATE_COST } from '@systems/AbilitySystem'
import { Icons } from '@ui/Icons'

export interface SkillBarHandlers {
  onUltimateClick: () => void
}

// Bottom-left cluster: a vertical cost gauge flanked by the two skill orbs.
// The basic orb is a cost readout only — basic attack fires directly from a
// board cell click, never from this button. Only the ultimate orb is
// clickable, hitting every living enemy at once.
//
// The gauge fill reads AbilitySystem.getSmoothCost() every frame (rAF,
// display only) so it visibly creeps up between regen ticks and drops the
// instant a cast spends cost; the big number below shows the whole-number
// cost that actually gates casting.
export class SkillBar {
  private readonly basicBtn: HTMLButtonElement
  private readonly ultimateBtn: HTMLButtonElement
  private readonly gaugeFill: HTMLElement
  private readonly gaugeValue: HTMLElement

  constructor(
    root: HTMLElement,
    private readonly ability: AbilitySystem,
    handlers: SkillBarHandlers
  ) {
    const bar = document.createElement('div')
    bar.className = 'skill-bar'

    const gauge = document.createElement('div')
    gauge.className = 'cost-gauge'
    gauge.innerHTML = `
      <div class="cost-gauge-track">
        <div class="cost-gauge-fill"></div>
        <div class="cost-gauge-ticks"></div>
      </div>
      <div class="cost-gauge-value">0</div>`
    this.gaugeFill = gauge.querySelector('.cost-gauge-fill') as HTMLElement
    this.gaugeValue = gauge.querySelector('.cost-gauge-value') as HTMLElement

    this.basicBtn = document.createElement('button')
    this.basicBtn.type = 'button'
    this.basicBtn.className = 'skill-orb skill-orb--basic'
    this.basicBtn.innerHTML = `${Icons.curseBolt()}<span class="skill-orb-cost">${BASIC_ATTACK_COST}</span>`

    this.ultimateBtn = document.createElement('button')
    this.ultimateBtn.type = 'button'
    this.ultimateBtn.className = 'skill-orb skill-orb--ultimate'
    this.ultimateBtn.innerHTML = `${Icons.curseBurst()}<span class="skill-orb-cost">${ULTIMATE_COST}</span>`
    this.ultimateBtn.addEventListener('click', handlers.onUltimateClick)

    bar.appendChild(gauge)
    bar.appendChild(this.basicBtn)
    bar.appendChild(this.ultimateBtn)
    root.appendChild(bar)

    const tick = (): void => {
      const smooth = this.ability.getSmoothCost() / this.ability.getMaxCost()
      this.gaugeFill.style.height = `${smooth * 100}%`
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  render(): void {
    this.basicBtn.classList.toggle('is-disabled', !this.ability.canCastBasic())
    this.ultimateBtn.classList.toggle('is-disabled', !this.ability.canCastUltimate())
    this.gaugeValue.textContent = `${this.ability.getCost()}`
  }
}
