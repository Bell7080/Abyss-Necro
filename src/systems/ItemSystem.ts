import type { ConsumableItem } from '@entities/ConsumableItem'

// Owns consumable-item state; ui/ItemInventory only renders whatever this holds.
export class ItemSystem {
  private items: ConsumableItem[] = []
  private readonly listeners: Array<(items: readonly ConsumableItem[]) => void> = []

  onChange(fn: (items: readonly ConsumableItem[]) => void): void {
    this.listeners.push(fn)
  }

  getItems(): readonly ConsumableItem[] {
    return this.items
  }

  addItem(item: ConsumableItem): void {
    this.items.push(item)
    this.emit()
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.items)
  }
}
