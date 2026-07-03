import type { AbilitySystem } from '@systems/AbilitySystem'
import { BASIC_ATTACK_COST, ULTIMATE_COST } from '@systems/AbilitySystem'
import { Icons } from '@ui/Icons'

export interface SkillBarHandlers {
  onUltimateClick: () => void
}

// Bottom-left pair of round skill orbs. The basic orb is a cost readout
// only — basic attack fires directly from a board cell click, never from
// this button. Only the ultimate orb is clickable, since summoning has no
// board cell to aim at — it always appears beside the boss room.
export class SkillBar {
  private readonly basicBtn: HTMLButtonElement
  private readonly ultimateBtn: HTMLButtonElement
  private readonly readout: HTMLElement

  constructor(
    root: HTMLElement,
    private readonly ability: AbilitySystem,
    handlers: SkillBarHandlers
  ) {
    const bar = document.createElement('div')
    bar.className = 'skill-bar'

    this.basicBtn = document.createElement('button')
    this.basicBtn.type = 'button'
    this.basicBtn.className = 'skill-orb skill-orb--basic'
    this.basicBtn.innerHTML = `${Icons.curseBolt()}<span class="skill-orb-cost">${BASIC_ATTACK_COST}</span>`

    this.ultimateBtn = document.createElement('button')
    this.ultimateBtn.type = 'button'
    this.ultimateBtn.className = 'skill-orb skill-orb--ultimate'
    this.ultimateBtn.innerHTML = `${Icons.curseBurst()}<span class="skill-orb-cost">${ULTIMATE_COST}</span>`
    this.ultimateBtn.addEventListener('click', handlers.onUltimateClick)

    this.readout = document.createElement('div')
    this.readout.className = 'skill-bar-readout'

    bar.appendChild(this.basicBtn)
    bar.appendChild(this.ultimateBtn)
    bar.appendChild(this.readout)
    root.appendChild(bar)
  }

  render(): void {
    const cost = this.ability.getCost()
    const max = this.ability.getMaxCost()
    this.basicBtn.classList.toggle('is-disabled', !this.ability.canCastBasic())
    this.ultimateBtn.classList.toggle('is-disabled', !this.ability.canCastUltimate())
    this.readout.textContent = `코스트 ${cost}/${max}`
  }
}
