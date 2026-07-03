import type { Relic } from '@entities/Relic'
import { Icons } from '@ui/Icons'

export interface RewardOverlayHandlers {
  onChoose: (relic: Relic, cardEl: HTMLElement) => void
}

// Full-viewport dim layer shown every few waves to offer a choice of 3
// relics. Sits above everything (including the skill bar/hand) so it also
// blocks board input for free while it's up — WaveSystem is paused
// separately so enemies don't keep moving behind it.
export class RewardOverlay {
  private readonly root: HTMLElement
  private readonly cardsEl: HTMLElement

  constructor(private readonly handlers: RewardOverlayHandlers) {
    this.root = document.createElement('div')
    this.root.className = 'reward-overlay'
    this.root.innerHTML = `<div class="reward-title">유물 획득</div>`

    this.cardsEl = document.createElement('div')
    this.cardsEl.className = 'reward-cards'
    this.root.appendChild(this.cardsEl)

    document.body.appendChild(this.root)
  }

  show(options: readonly Relic[]): void {
    this.cardsEl.innerHTML = ''
    options.forEach((relic) => {
      const card = document.createElement('button')
      card.type = 'button'
      card.className = 'reward-card'
      card.innerHTML = `<div class="reward-card-art">${Icons.relicGem()}</div><div class="reward-card-name">${relic.label}</div>`
      card.addEventListener('click', () => this.handlers.onChoose(relic, card))
      this.cardsEl.appendChild(card)
    })
    // Next frame, so the enter transition actually plays instead of
    // snapping in with the freshly-created cards.
    requestAnimationFrame(() => this.root.classList.add('is-visible'))
  }

  hide(): void {
    this.root.classList.remove('is-visible')
  }
}
