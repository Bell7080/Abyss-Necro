import { getCreature } from '@data/CreatureDefinitions'
import { getEpicCard } from '@data/EpicCardDefinitions'
import { getItemCard } from '@data/ItemCardDefinitions'
import type { HandCard } from '@entities/Card'

export interface InspectorStat {
  label: string
  value: string
}

export interface InspectorData {
  imageUrl?: string
  title: string
  tag: string
  /** Tier rank, drawn as ★ stars under the title (creature cards/allies). */
  stars?: number
  /** Attack / hp chips, shown for board units. */
  stats?: InspectorStat[]
  desc?: string
  /** Signature passive line (board units). */
  passive?: string
  /** Active cell buffs (e.g. trap-star stacks). */
  buffs?: string
}

// Right-side inspector panel — a port of Unmelting's hearth inspector
// anatomy (full-bleed art on top, near-black gradient converging downward,
// text block anchored at the vertical middle). Shows the selected hand card
// while aiming, and hovered board units / buffed cells otherwise.
export class CardInspector {
  private readonly panel: HTMLElement
  private readonly artEl: HTMLElement
  private readonly titleEl: HTMLElement
  private readonly starsEl: HTMLElement
  private readonly tagsEl: HTMLElement
  private readonly statsEl: HTMLElement
  private readonly descEl: HTMLElement
  private readonly passiveEl: HTMLElement
  private readonly buffsEl: HTMLElement

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
        <div class="card-inspector-stars"></div>
        <div class="card-inspector-divider" aria-hidden="true"></div>
        <div class="card-inspector-tags"></div>
        <div class="card-inspector-stats"></div>
        <div class="card-inspector-desc"></div>
        <div class="card-inspector-passive"></div>
        <div class="card-inspector-buffs"></div>
      </div>`

    this.artEl = this.panel.querySelector('.card-inspector-art') as HTMLElement
    this.titleEl = this.panel.querySelector('.card-inspector-title') as HTMLElement
    this.starsEl = this.panel.querySelector('.card-inspector-stars') as HTMLElement
    this.tagsEl = this.panel.querySelector('.card-inspector-tags') as HTMLElement
    this.statsEl = this.panel.querySelector('.card-inspector-stats') as HTMLElement
    this.descEl = this.panel.querySelector('.card-inspector-desc') as HTMLElement
    this.passiveEl = this.panel.querySelector('.card-inspector-passive') as HTMLElement
    this.buffsEl = this.panel.querySelector('.card-inspector-buffs') as HTMLElement
    root.appendChild(this.panel)
  }

  /** Generic render used by both hand-card and board-unit/cell inspection. */
  render(data: InspectorData): void {
    this.artEl.style.backgroundImage = data.imageUrl ? `url('${data.imageUrl}')` : ''
    this.titleEl.textContent = data.title
    this.starsEl.textContent = data.stars ? '★'.repeat(data.stars) : ''
    this.starsEl.style.display = data.stars ? 'block' : 'none'
    this.tagsEl.textContent = data.tag

    this.statsEl.innerHTML = (data.stats ?? [])
      .map(
        (s) =>
          `<span class="inspector-stat"><span class="inspector-stat-label">${s.label}</span><span class="inspector-stat-value">${s.value}</span></span>`
      )
      .join('')
    this.statsEl.style.display = data.stats?.length ? 'flex' : 'none'

    this.descEl.textContent = data.desc ?? ''
    this.descEl.style.display = data.desc ? 'block' : 'none'

    this.passiveEl.textContent = data.passive ?? ''
    this.passiveEl.style.display = data.passive ? 'block' : 'none'

    this.buffsEl.textContent = data.buffs ?? ''
    this.buffsEl.style.display = data.buffs ? 'block' : 'none'

    this.panel.classList.add('is-shown')
    this.panel.setAttribute('aria-hidden', 'false')
  }

  show(card: HandCard): void {
    if (card.kind === 'epic') {
      const epic = getEpicCard(card.itemId ?? '')
      this.render({ title: card.label, tag: '에픽 · 시설 카드', desc: epic?.desc ?? '영구적인 효과를 남긴다.' })
    } else if (card.kind === 'item') {
      const item = getItemCard(card.itemId ?? '')
      this.render({ title: card.label, tag: '아이템 카드 · 사용형', desc: item?.desc ?? '사용하면 소모된다.' })
    } else {
      const creature = getCreature(card.creatureId)
      this.render({
        imageUrl: creature?.allyArt,
        title: card.label,
        stars: card.tier ?? 1,
        tag: card.tier === 2 ? '진화체 · 강화된 사령' : '사령 카드',
        desc:
          card.tier === 2
            ? '세 장의 기억이 하나로 뭉친 사령. 칸을 골라 배치하면 아군 디펜더로 깨어난다.'
            : '심연에서 건져 올린 사령. 칸을 골라 배치하면 아군 디펜더로 깨어나 그 자리를 지킨다.',
        passive: creature?.passive,
      })
    }
  }

  hide(): void {
    this.panel.classList.remove('is-shown')
    this.panel.setAttribute('aria-hidden', 'true')
  }
}
