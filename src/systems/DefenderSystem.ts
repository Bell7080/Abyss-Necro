import type { AllyToken } from '@entities/AllyToken'

const CELL_COUNT = 9
const ALLY_BASE_HP = 6

// Owns placed defenders (one per board cell). WaveSystem queries/damages
// this through the small DefenderHooks interface it declares, so the two
// systems don't hold references to each other.
export class DefenderSystem {
  private cells: Array<AllyToken | null> = new Array(CELL_COUNT).fill(null)
  private readonly listeners: Array<() => void> = []

  onChange(fn: () => void): void {
    this.listeners.push(fn)
  }

  getCells(): readonly (AllyToken | null)[] {
    return this.cells
  }

  canPlace(cellIndex: number): boolean {
    return !this.cells[cellIndex]
  }

  place(cellIndex: number, label: string): boolean {
    if (!this.canPlace(cellIndex)) return false
    this.cells[cellIndex] = {
      id: `ally-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label,
      hp: ALLY_BASE_HP,
      maxHp: ALLY_BASE_HP,
    }
    this.emit()
    return true
  }

  getHp(cellIndex: number): number | null {
    return this.cells[cellIndex]?.hp ?? null
  }

  /** An enemy bumping into this cell calls this. Returns true if the
   * defender died (the cell is now free). */
  damage(cellIndex: number, amount: number): boolean {
    const ally = this.cells[cellIndex]
    if (!ally) return false
    ally.hp -= amount
    const died = ally.hp <= 0
    if (died) this.cells[cellIndex] = null
    this.emit()
    return died
  }

  private emit(): void {
    for (const fn of this.listeners) fn()
  }
}
