import type { EnemyToken } from '@entities/EnemyToken'

const CELL_COUNT = 9
const CARD_DROP_CHANCE = 0.5
const WAVES_PER_RELIC = 3
const NEXT_WAVE_DELAY_MS = 500

// First real implementation of the core defense rule (kill -> 50% card drop,
// clear board -> next wave, every 3 clears -> relic). Enemy tokens are
// placeholder art until the 40-enemy roster/combat stats land — the rule
// itself is not a stub.
export class WaveSystem {
  private cells: Array<EnemyToken | null> = []
  private waveNumber = 1
  private wavesSinceRelic = 0
  private readonly listeners: Array<() => void> = []

  constructor() {
    this.spawnWave()
  }

  onChange(fn: () => void): void {
    this.listeners.push(fn)
  }

  getCells(): readonly (EnemyToken | null)[] {
    return this.cells
  }

  getWaveNumber(): number {
    return this.waveNumber
  }

  defeat(cellIndex: number): { dropCard: boolean; relicAwarded: boolean } {
    const enemy = this.cells[cellIndex]
    if (!enemy) return { dropCard: false, relicAwarded: false }

    this.cells[cellIndex] = null
    const dropCard = Math.random() < CARD_DROP_CHANCE
    const cleared = this.cells.every((cell) => cell === null)
    let relicAwarded = false

    if (cleared) {
      this.waveNumber += 1
      this.wavesSinceRelic += 1
      if (this.wavesSinceRelic >= WAVES_PER_RELIC) {
        this.wavesSinceRelic = 0
        relicAwarded = true
      }
      window.setTimeout(() => this.spawnWave(), NEXT_WAVE_DELAY_MS)
    }

    this.emit()
    return { dropCard, relicAwarded }
  }

  private spawnWave(): void {
    this.cells = Array.from({ length: CELL_COUNT }, (_, i) => ({
      id: `enemy-${this.waveNumber}-${i}`,
    }))
    this.emit()
  }

  private emit(): void {
    for (const fn of this.listeners) fn()
  }
}
