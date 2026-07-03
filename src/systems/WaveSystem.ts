import type { EnemyToken } from '@entities/EnemyToken'

const ROWS = 3
const COLS = 3
const ENTRY_COL = COLS - 1 // rightmost column — entrance, opposite the boss room
const ENEMY_BASE_HP = 4
const CARD_DROP_CHANCE = 0.5
const WAVES_PER_RELIC = 3
const NEXT_WAVE_DELAY_MS = 600
const MOVE_TICK_MS = 1100

export interface EncounterResult {
  /** Grid cell the enemy was standing in when the fight resolved. */
  cellIndex: number
  dropCard: boolean
  relicAwarded: boolean
  /** True if the enemy walked into the boss room instead of being attacked. */
  viaBossRoom: boolean
}

export interface DamageResult {
  cellIndex: number
  amount: number
  defeated: boolean
}

// Enemies enter at the grid's far edge (opposite the boss room) and wander
// toward it a step per tick; reaching the boss room resolves as a fight the
// same way a killing blow does, so ignoring the board has a real cost once
// player HP/loss exists. Enemy tokens and hp are placeholder values until
// the 40-enemy roster and real combat stats land — the movement/encounter
// rule itself is not a stub.
export class WaveSystem {
  private cells: Array<EnemyToken | null> = new Array(ROWS * COLS).fill(null)
  private waveNumber = 1
  private wavesSinceRelic = 0
  private aliveInWave = 0
  private readonly changeListeners: Array<() => void> = []
  private readonly encounterListeners: Array<(result: EncounterResult) => void> = []

  constructor() {
    this.spawnWave()
    window.setInterval(() => this.tick(), MOVE_TICK_MS)
  }

  onChange(fn: () => void): void {
    this.changeListeners.push(fn)
  }

  onEncounter(fn: (result: EncounterResult) => void): void {
    this.encounterListeners.push(fn)
  }

  getCells(): readonly (EnemyToken | null)[] {
    return this.cells
  }

  getWaveNumber(): number {
    return this.waveNumber
  }

  getAliveCellIndices(): number[] {
    return this.cells.map((enemy, index) => (enemy ? index : -1)).filter((index) => index >= 0)
  }

  /** Player abilities land here — basic attack targets one cell, the
   * ultimate calls this once per alive cell. Returns null if the cell was
   * empty (a whiffed shot) so the caller can skip the damage-number fx. */
  applyDamage(cellIndex: number, amount: number): DamageResult | null {
    const enemy = this.cells[cellIndex]
    if (!enemy) return null

    enemy.hp -= amount
    if (enemy.hp <= 0) {
      this.resolveEncounter(cellIndex, false)
      return { cellIndex, amount, defeated: true }
    }

    this.emitChange()
    return { cellIndex, amount, defeated: false }
  }

  private tick(): void {
    // Snapshot occupied indices first so an enemy that moves this tick isn't
    // immediately moved again while iterating.
    const occupied = this.cells
      .map((enemy, index) => (enemy ? index : -1))
      .filter((index) => index >= 0)

    for (const index of occupied) {
      const enemy = this.cells[index]
      if (enemy) this.stepEnemy(index, enemy)
    }
    this.emitChange()
  }

  private stepEnemy(index: number, enemy: EnemyToken): void {
    const roll = Math.random()
    let targetRow = enemy.row
    let targetCol = enemy.col

    if (roll < 0.6) {
      targetCol = enemy.col - 1 // advance toward the boss room
    } else if (roll < 0.8 && enemy.row > 0) {
      targetRow = enemy.row - 1 // wander up
    } else if (roll < 0.95 && enemy.row < ROWS - 1) {
      targetRow = enemy.row + 1 // wander down
    } else {
      return // idle this tick
    }

    if (targetCol < 0) {
      this.resolveEncounter(index, true)
      return
    }

    const targetIndex = targetRow * COLS + targetCol
    if (this.cells[targetIndex]) return // another enemy already occupies it

    this.cells[index] = null
    this.cells[targetIndex] = { ...enemy, row: targetRow, col: targetCol }
  }

  private resolveEncounter(cellIndex: number, viaBossRoom: boolean): void {
    this.cells[cellIndex] = null
    const dropCard = Math.random() < CARD_DROP_CHANCE
    this.aliveInWave -= 1
    let relicAwarded = false

    if (this.aliveInWave <= 0) {
      this.waveNumber += 1
      this.wavesSinceRelic += 1
      if (this.wavesSinceRelic >= WAVES_PER_RELIC) {
        this.wavesSinceRelic = 0
        relicAwarded = true
      }
      window.setTimeout(() => this.spawnWave(), NEXT_WAVE_DELAY_MS)
    }

    this.emitChange()
    this.emitEncounter({ cellIndex, dropCard, relicAwarded, viaBossRoom })
  }

  private spawnWave(): void {
    this.cells = new Array(ROWS * COLS).fill(null)
    for (let row = 0; row < ROWS; row += 1) {
      this.cells[row * COLS + ENTRY_COL] = {
        id: `enemy-${this.waveNumber}-${row}`,
        row,
        col: ENTRY_COL,
        hp: ENEMY_BASE_HP,
        maxHp: ENEMY_BASE_HP,
      }
    }
    this.aliveInWave = ROWS
    this.emitChange()
  }

  private emitChange(): void {
    for (const fn of this.changeListeners) fn()
  }

  private emitEncounter(result: EncounterResult): void {
    for (const fn of this.encounterListeners) fn(result)
  }
}
