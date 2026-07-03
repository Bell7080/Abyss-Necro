import type { AbilitySystem } from '@systems/AbilitySystem'
import { Icons } from '@ui/Icons'

export interface SkillBarHandlers {
  onBasicClick: () => void
  onUltimateClick: () => void
}

// Bottom-left pair of round skill orbs. Display only — AbilitySystem owns
// cost/armed state, Game.ts owns what a click actually does.
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
    this.basicBtn.innerHTML = `${Icons.curseBolt()}<span class="skill-orb-cost">1</span>`
    this.basicBtn.addEventListener('click', handlers.onBasicClick)

    this.ultimateBtn = document.createElement('button')
    this.ultimateBtn.type = 'button'
    this.ultimateBtn.className = 'skill-orb skill-orb--ultimate'
    this.ultimateBtn.innerHTML = `${Icons.curseBurst()}<span class="skill-orb-cost">10</span>`
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
    this.basicBtn.classList.toggle('is-armed', this.ability.isBasicArmed())
    this.basicBtn.classList.toggle('is-disabled', !this.ability.canCastBasic())
    this.ultimateBtn.classList.toggle('is-disabled', !this.ability.canCastUltimate())
    this.readout.textContent = `코스트 ${cost}/${max}`
  }
}
