import type { AllyToken } from '@entities/AllyToken'
import { BOSS_CELL_INDEX } from '@systems/BoardConstants'

const ROWS = 3
const COLS = 3
const CELL_COUNT = ROWS * COLS
const MAX_ALLIES_PER_CELL = 3
const ALLY_BASE_HP = 3
// Fallback attack for allies that don't carry their own value (placed hand
// cards) — summons always set an explicit attack instead.
const DEFAULT_ALLY_ATTACK = 2

// Owns placed defenders — up to 3 per grid cell, plus a boss-room slot
// (also capped at 3) so the player can stack allies right next to
// themselves. WaveSystem queries/damages this through the small
// DefenderHooks interface it declares, so the two systems don't hold
// references to each other. Also owns ability-summoned roaming minions:
// unlike placed cards they carry a movesLeft budget and physically walk
// between cells (stepSummons()), sharing the same clash resolution in
// WaveSystem since they live in the same per-cell arrays.
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

  /** Front defender's attack, for WaveSystem to apply on a clash — summons
   * carry their own value, placed cards fall back to the shared default. */
  getAttack(cellIndex: number): number | null {
    const ally = this.listFor(cellIndex)[0]
    return ally ? ally.attack ?? DEFAULT_ALLY_ATTACK : null
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

  /** Ability-triggered roaming minion — appears beside the boss room (grid
   * column 0, random row) and wanders deeper into the field a step per
   * WaveSystem tick until its move budget runs out (stepSummons()), then
   * disappears. Bypasses the 3-per-cell placement cap since it's a
   * temporary effect rather than a manual deployment. */
  summon(label: string, hp: number, attack: number, moves: number): void {
    const row = Math.floor(Math.random() * ROWS)
    this.cells[row * COLS].push({
      id: `summon-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label,
      hp,
      maxHp: hp,
      attack,
      movesLeft: moves,
    })
    this.emit()
  }

  /** Advances every roaming summon one step (called from WaveSystem's tick,
   * in lockstep with enemy movement, so a summon walking into an enemy's
   * cell is resolved by the same tick's clash check — not a tick late). */
  stepSummons(): void {
    // Snapshot [cellIndex, token] pairs up front — a summon that moves into
    // a not-yet-visited cell this tick must not be stepped a second time.
    const toStep: Array<[number, AllyToken]> = []
    this.cells.forEach((list, index) => {
      for (const token of list) {
        if (token.movesLeft !== undefined) toStep.push([index, token])
      }
    })
    for (const [index, token] of toStep) this.stepSummon(index, token)
    this.emit()
  }

  private stepSummon(index: number, token: AllyToken): void {
    const row = Math.floor(index / COLS)
    const col = index % COLS
    const roll = Math.random()
    let targetRow = row
    let targetCol = col

    if (roll < 0.6 && col < COLS - 1) {
      targetCol = col + 1 // advance deeper into the field, away from the boss room
    } else if (roll < 0.8 && row > 0) {
      targetRow = row - 1
    } else if (roll < 0.95 && row < ROWS - 1) {
      targetRow = row + 1
    } else {
      return // idle this tick — no move spent
    }

    const list = this.cells[index]
    const i = list.indexOf(token)
    if (i >= 0) list.splice(i, 1)

    token.movesLeft = (token.movesLeft ?? 1) - 1
    if (token.movesLeft <= 0) return // move budget spent — vanishes here

    this.cells[targetRow * COLS + targetCol].push(token)
  }

  private listFor(cellIndex: number): AllyToken[] {
    return cellIndex === BOSS_CELL_INDEX ? this.bossAllies : this.cells[cellIndex]
  }

  private emit(): void {
    for (const fn of this.listeners) fn()
  }
}
