import type { ConsumableItem } from '@entities/ConsumableItem'
import { Icons } from '@ui/Icons'

const MIN_SLOTS = 6

// Bottom-right consumable grid, stacked under the relic panel — same glass
// panel language, filled slots hold a vial icon instead of a gem.
export class ItemInventory {
  private readonly panel: HTMLElement
  private readonly grid: HTMLElement

  constructor(root: HTMLElement) {
    this.panel = document.createElement('div')
    this.panel.className = 'item-panel'
    this.panel.innerHTML = `<div class="item-panel-title">인벤토리</div>`
    this.grid = document.createElement('div')
    this.grid.className = 'item-grid'
    this.panel.appendChild(this.grid)
    root.appendChild(this.panel)
  }

  render(items: readonly ConsumableItem[]): void {
    const slotCount = Math.max(MIN_SLOTS, items.length)
    this.grid.innerHTML = ''
    for (let i = 0; i < slotCount; i += 1) {
      const slot = document.createElement('div')
      slot.className = 'item-slot'
      const item = items[i]
      if (item) {
        slot.classList.add('is-filled')
        slot.title = item.label
        slot.innerHTML = Icons.itemVial()
      }
      this.grid.appendChild(slot)
    }
  }

  /** Viewport point an incoming item-drop bubble should aim at. */
  getDropPoint(): { x: number; y: number } {
    const rect = this.panel.getBoundingClientRect()
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  }
}
