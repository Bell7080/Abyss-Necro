import { getCreature } from '@data/CreatureDefinitions'
import { getItemCard } from '@data/ItemCardDefinitions'
import type { HandCard } from '@entities/Card'

// Left-side card description panel, shown while a hand card is selected —
// a straight port of Unmelting's hearth inspector anatomy (full-bleed art
// on top, near-black gradient converging downward, title/divider/tags/desc
// anchored at the vertical middle), mirrored for the left edge and recolored
// for the abyss. Its bottom hosts the relic tab (mounted by Game) so the
// panel's lower half never sits empty.
export class CardInspector {
  private readonly panel: HTMLElement
  private readonly artEl: HTMLElement
  private readonly titleEl: HTMLElement
  private readonly tagsEl: HTMLElement
  private readonly descEl: HTMLElement
  /** Slot the relic inventory renders into (Game mounts it once). */
  readonly relicSlot: HTMLElement

  constructor(root: HTMLElement) {
    this.panel = document.createElement('div')
    this.panel.className = 'card-inspector'
    this.panel.setAttribute('aria-hidden', 'true')
    this.panel.innerHTML = `
      <div class="card-inspector-scrim" aria-hidden="true">
        <div class="card-inspector-art"></div>
        <div class="card-inspector-grad"></div>
      </div>
      <div class="card-inspector-body">
        <div class="card-inspector-title"></div>
        <div class="card-inspector-divider" aria-hidden="true"></div>
        <div class="card-inspector-tags"></div>
        <div class="card-inspector-desc"></div>
        <div class="card-inspector-relics"></div>
      </div>`

    this.artEl = this.panel.querySelector('.card-inspector-art') as HTMLElement
    this.titleEl = this.panel.querySelector('.card-inspector-title') as HTMLElement
    this.tagsEl = this.panel.querySelector('.card-inspector-tags') as HTMLElement
    this.descEl = this.panel.querySelector('.card-inspector-desc') as HTMLElement
    this.relicSlot = this.panel.querySelector('.card-inspector-relics') as HTMLElement
    root.appendChild(this.panel)
  }

  show(card: HandCard): void {
    if (card.kind === 'item') {
      const item = getItemCard(card.itemId ?? '')
      this.artEl.style.backgroundImage = ''
      this.titleEl.textContent = card.label
      this.tagsEl.textContent = '아이템 카드 · 사용형'
      this.descEl.textContent = item?.desc ?? '사용하면 소모된다.'
    } else {
      const creature = getCreature(card.creatureId)
      this.artEl.style.backgroundImage = creature ? `url('${creature.allyArt}')` : ''
      this.titleEl.textContent = card.label
      this.tagsEl.textContent = card.tier === 2 ? '진화체 · 강화된 사령' : '사령 카드'
      this.descEl.textContent =
        card.tier === 2
          ? '세 장의 기억이 하나로 뭉친 사령. 칸을 골라 배치하면 아군 디펜더로 깨어난다.'
          : '심연에서 건져 올린 사령. 칸을 골라 배치하면 아군 디펜더로 깨어나 그 자리를 지킨다.'
    }
    this.panel.classList.add('is-shown')
    this.panel.setAttribute('aria-hidden', 'false')
  }

  hide(): void {
    this.panel.classList.remove('is-shown')
    this.panel.setAttribute('aria-hidden', 'true')
  }
}
