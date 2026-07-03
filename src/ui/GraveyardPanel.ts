import type { Star } from '@systems/GraveyardSystem'
import { getCreature } from '@data/CreatureDefinitions'

// Left-edge graveyard dock: a vertical column of stars, one per fallen
// creature-ally. Stars group visually by creature; hovering one names whose
// star it is. A twinkle marks any creature with a reclaimable triple during
// the round-end lull.
export class GraveyardPanel {
  private readonly panel: HTMLElement
  private readonly list: HTMLElement

  constructor(root: HTMLElement) {
    this.panel = document.createElement('div')
    this.panel.className = 'graveyard-panel'
    this.panel.innerHTML = `
      <div class="graveyard-title">묘지</div>
      <div class="graveyard-stars"></div>`
    this.list = this.panel.querySelector('.graveyard-stars') as HTMLElement
    root.appendChild(this.panel)
  }

  render(stars: readonly Star[]): void {
    // Count per creature so the third star of a kind can be flagged as a
    // completed (reclaimable) triple.
    const seen = new Map<string, number>()
    this.list.innerHTML = ''
    for (const star of stars) {
      const n = (seen.get(star.creatureId) ?? 0) + 1
      seen.set(star.creatureId, n)

      const el = document.createElement('div')
      el.className = 'graveyard-star'
      if (n % 3 === 0) el.classList.add('is-triple')
      el.style.setProperty('--star-i', `${this.list.children.length}`)
      const creature = getCreature(star.creatureId)
      el.innerHTML = `
        <span class="graveyard-star-glyph">✦</span>
        <span class="graveyard-star-tip">${creature?.label ?? star.label}의 별</span>`
      this.list.appendChild(el)
    }
    this.panel.classList.toggle('is-empty', stars.length === 0)
  }

  /** Viewport point a flying star should land on (the bottom of the stack). */
  getDropPoint(): { x: number; y: number } {
    const rect = this.panel.getBoundingClientRect()
    return { x: rect.left + rect.width / 2, y: rect.bottom - 24 }
  }
}
