import type { AllyToken } from '@entities/AllyToken'
import { BOSS_CELL_INDEX } from '@systems/BoardConstants'

const CELL_COUNT = 9
const MAX_ALLIES_PER_CELL = 3
const ALLY_BASE_HP = 6

// Owns placed defenders — up to 3 per grid cell, plus a boss-room slot
// (also capped at 3) so the player can stack allies right next to
// themselves. WaveSystem queries/damages this through the small
// DefenderHooks interface it declares, so the two systems don't hold
// references to each other.
export class DefenderSystem {
  private cells: AllyToken[][] = Array.from({ length: CELL_COUNT }, () => [])
  private bossAllies: AllyToken[] = []
  private readonly listeners: Array<() => void> = []

  onChange(fn: () => void): void {
    this.listeners.push(fn)
  }

  getCells(): readonly AllyToken[][] {
    return this.cells
  }

  getBossAllies(): readonly AllyToken[] {
    return this.bossAllies
  }

  canPlace(cellIndex: number): boolean {
    return this.listFor(cellIndex).length < MAX_ALLIES_PER_CELL
  }

  place(cellIndex: number, label: string): boolean {
    if (!this.canPlace(cellIndex)) return false
    this.listFor(cellIndex).push({
      id: `ally-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label,
      hp: ALLY_BASE_HP,
      maxHp: ALLY_BASE_HP,
    })
    this.emit()
    return true
  }

  getHp(cellIndex: number): number | null {
    return this.listFor(cellIndex)[0]?.hp ?? null
  }

  /** An enemy bumping into this cell calls this. Returns true if the front
   * defender died (freeing a slot). */
  damage(cellIndex: number, amount: number): boolean {
    const list = this.listFor(cellIndex)
    const ally = list[0]
    if (!ally) return false
    ally.hp -= amount
    const died = ally.hp <= 0
    if (died) list.shift()
    this.emit()
    return died
  }

  private listFor(cellIndex: number): AllyToken[] {
    return cellIndex === BOSS_CELL_INDEX ? this.bossAllies : this.cells[cellIndex]
  }

  private emit(): void {
    for (const fn of this.listeners) fn()
  }
}
