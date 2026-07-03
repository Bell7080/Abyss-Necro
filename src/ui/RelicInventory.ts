import type { Relic } from '@entities/Relic'
import { Icons } from '@ui/Icons'

const MIN_SLOTS = 6

// Bottom-right relic grid — dark glass panel, filled slots glow, empty
// slots stay as faint sockets so the eventual reward has somewhere to land.
export class RelicInventory {
  private readonly grid: HTMLElement

  constructor(root: HTMLElement) {
    const panel = document.createElement('div')
    panel.className = 'relic-panel'
    panel.innerHTML = `<div class="relic-panel-title">유물</div>`
    this.grid = document.createElement('div')
    this.grid.className = 'relic-grid'
    panel.appendChild(this.grid)
    root.appendChild(panel)
  }

  render(relics: readonly Relic[]): void {
    const slotCount = Math.max(MIN_SLOTS, relics.length)
    this.grid.innerHTML = ''
    for (let i = 0; i < slotCount; i += 1) {
      const slot = document.createElement('div')
      slot.className = 'relic-slot'
      const relic = relics[i]
      if (relic) {
        slot.classList.add('is-filled')
        slot.title = relic.label
        slot.innerHTML = Icons.relicGem()
      }
      this.grid.appendChild(slot)
    }
  }
}
