import type { Relic } from '@entities/Relic'

// Owns relic-inventory state; ui/RelicInventory only renders whatever this holds.
export class RelicSystem {
  private relics: Relic[] = []
  private readonly listeners: Array<(relics: readonly Relic[]) => void> = []

  onChange(fn: (relics: readonly Relic[]) => void): void {
    this.listeners.push(fn)
  }

  getRelics(): readonly Relic[] {
    return this.relics
  }

  addRelic(relic: Relic): void {
    this.relics.push(relic)
    this.emit()
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.relics)
  }
}
