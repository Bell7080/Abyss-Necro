import type { EnemyToken } from '@entities/EnemyToken'

const ROWS = 3
const COLS = 3
const ENTRY_COL = COLS - 1 // rightmost column — entrance, opposite the boss room
const ENEMY_BASE_HP = 4
const ENEMY_ATTACK_DAMAGE = 1
const ALLY_COUNTER_DAMAGE = 2
const CARD_DROP_CHANCE = 0.5
const ITEM_DROP_CHANCE = 0.35
const MOVE_TICK_MS = 1100
// A new wave forces its way in every 3 minutes regardless of whether the
// board is cleared — this is the actual pacing mechanism now, not just a
// display countdown.
const WAVE_PUSH_INTERVAL_MS = 3 * 60 * 1000
const WAVES_PER_CHECKPOINT = 5
const CHECKPOINTS_PER_RELIC = 3

export interface EncounterResult {
  /** Grid cell the enemy was standing in when the fight resolved. */
  cellIndex: number
  dropCard: boolean
  dropItem: boolean
  /** True if the enemy walked into the boss room instead of being attacked. */
  viaBossRoom: boolean
}

export interface DamageResult {
  cellIndex: number
  amount: number
  defeated: boolean
}

export interface CheckpointInfo {
  checkpointNumber: number
  isRelicCheckpoint: boolean
}

// Lets WaveSystem clash with placed defenders without holding a reference to
// DefenderSystem itself — Game.ts wires the two together.
export interface DefenderHooks {
  getHp(cellIndex: number): number | null
  damage(cellIndex: number, amount: number): boolean
}

// Enemies enter at the grid's far edge (opposite the boss room) and wander
// toward it a step per tick; reaching the boss room resolves as a fight the
// same way a killing blow does. A defender-occupied cell blocks the step
// and both sides trade damage instead. A new wave of 3 forces its way in
// every WAVE_PUSH_INTERVAL_MS regardless of whether the board is cleared —
// surviving stragglers just mean fewer entry slots are free for the push.
// Every 5 pushes is a checkpoint: the push timer/movement pause for a lull,
// and every 3rd checkpoint offers a relic instead of just resuming. Enemy
// tokens and hp are placeholder values until the 40-enemy roster and real
// combat stats land — the movement/encounter/checkpoint rules themselves
// are not stubs.
export class WaveSystem {
  private cells: Array<EnemyToken | null> = new Array(ROWS * COLS).fill(null)
  private waveNumber = 1
  private wavesSinceCheckpoint = 0
  private checkpointCount = 0
  private waveStartedAt = Date.now()
  private paused = false
  private readonly changeListeners: Array<() => void> = []
  private readonly encounterListeners: Array<(result: EncounterResult) => void> = []
  private readonly checkpointListeners: Array<(info: CheckpointInfo) => void> = []

  constructor(private readonly defenders?: DefenderHooks) {
    this.spawnWave()
    window.setInterval(() => this.tick(), MOVE_TICK_MS)
    this.schedulePush()
  }

  onChange(fn: () => void): void {
    this.changeListeners.push(fn)
  }

  onEncounter(fn: (result: EncounterResult) => void): void {
    this.encounterListeners.push(fn)
  }

  onCheckpoint(fn: (info: CheckpointInfo) => void): void {
    this.checkpointListeners.push(fn)
  }

  getCells(): readonly (EnemyToken | null)[] {
    return this.cells
  }

  getWaveNumber(): number {
    return this.waveNumber
  }

  isPaused(): boolean {
    return this.paused
  }

  /** Milliseconds left until the next forced wave push (HUD only while unpaused). */
  getRemainingMs(): number {
    return Math.max(0, WAVE_PUSH_INTERVAL_MS - (Date.now() - this.waveStartedAt))
  }

  getAliveCellIndices(): number[] {
    return this.cells.map((enemy, index) => (enemy ? index : -1)).filter((index) => index >= 0)
  }

  /** Called once the player acknowledges a checkpoint (proceed button, or
   * after picking a relic) — restarts the push timer. */
  resumeFromCheckpoint(): void {
    this.paused = false
    this.waveStartedAt = Date.now()
    this.schedulePush()
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

  private schedulePush(): void {
    window.setTimeout(() => this.handlePushTimeout(), WAVE_PUSH_INTERVAL_MS)
  }

  private handlePushTimeout(): void {
    this.pushReinforcements()
    this.wavesSinceCheckpoint += 1

    if (this.wavesSinceCheckpoint >= WAVES_PER_CHECKPOINT) {
      this.wavesSinceCheckpoint = 0
      this.checkpointCount += 1
      this.paused = true
      this.emitCheckpoint({
        checkpointNumber: this.checkpointCount,
        isRelicCheckpoint: this.checkpointCount % CHECKPOINTS_PER_RELIC === 0,
      })
      return
    }

    this.waveStartedAt = Date.now()
    this.schedulePush()
  }

  private tick(): void {
    if (this.paused) return
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

    const defenderHp = this.defenders?.getHp(targetIndex)
    if (defenderHp !== null && defenderHp !== undefined) {
      // Blocked by a defender — both sides trade damage this tick instead
      // of the enemy advancing.
      this.defenders?.damage(targetIndex, ENEMY_ATTACK_DAMAGE)
      this.applyDamage(index, ALLY_COUNTER_DAMAGE)
      return
    }

    this.cells[index] = null
    this.cells[targetIndex] = { ...enemy, row: targetRow, col: targetCol }
  }

  private resolveEncounter(cellIndex: number, viaBossRoom: boolean): void {
    this.cells[cellIndex] = null
    const dropCard = Math.random() < CARD_DROP_CHANCE
    const dropItem = Math.random() < ITEM_DROP_CHANCE

    this.emitChange()
    this.emitEncounter({ cellIndex, dropCard, dropItem, viaBossRoom })
  }

  /** Initial board fill only — later waves arrive via pushReinforcements(). */
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
    this.emitChange()
  }

  /** A forced wave push — tops up the entry column, skipping any cell a
   * straggler is still standing in rather than overwriting it. */
  private pushReinforcements(): void {
    this.waveNumber += 1
    for (let row = 0; row < ROWS; row += 1) {
      const idx = row * COLS + ENTRY_COL
      if (this.cells[idx]) continue
      this.cells[idx] = {
        id: `enemy-${this.waveNumber}-${row}`,
        row,
        col: ENTRY_COL,
        hp: ENEMY_BASE_HP,
        maxHp: ENEMY_BASE_HP,
      }
    }
    this.emitChange()
  }

  private emitChange(): void {
    for (const fn of this.changeListeners) fn()
  }

  private emitEncounter(result: EncounterResult): void {
    for (const fn of this.encounterListeners) fn(result)
  }

  private emitCheckpoint(info: CheckpointInfo): void {
    for (const fn of this.checkpointListeners) fn(info)
  }
}
