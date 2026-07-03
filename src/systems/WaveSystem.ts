import type { EnemyToken } from '@entities/EnemyToken'
import { BOSS_CELL_INDEX } from '@systems/BoardConstants'

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
// board is cleared — this is the actual pacing mechanism, not just a
// display countdown.
const WAVE_PUSH_INTERVAL_MS = 3 * 60 * 1000
const WAVES_PER_CHECKPOINT = 5
const CHECKPOINTS_PER_RELIC = 3

export interface EncounterResult {
  /** Grid cell (or BOSS_CELL_INDEX) the enemy was standing in when it died. */
  cellIndex: number
  dropCard: boolean
  dropItem: boolean
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

export interface ClashInfo {
  cellIndex: number
}

// Lets WaveSystem clash with placed defenders without holding a reference to
// DefenderSystem itself — Game.ts wires the two together. cellIndex may be
// BOSS_CELL_INDEX.
export interface DefenderHooks {
  getHp(cellIndex: number): number | null
  damage(cellIndex: number, amount: number): boolean
}

// Enemies enter at the grid's far edge (opposite the boss room) and wander
// toward it a step per tick, moving freely through any cell — allies don't
// block movement anymore. Any number of enemies can share a cell; combat
// only starts once an enemy and a defender actually occupy the same cell,
// and while that fight is on the enemy holds still there instead of
// wandering off (see stepEnemy's early-out). Enemies that walk off the
// grid's near edge don't auto-resolve — they cross into the boss room and
// stand there as a real, attackable threat next to the player, which can
// also hold defenders. A new wave of 3 forces its way in every
// WAVE_PUSH_INTERVAL_MS; every 5 pushes is a checkpoint (movement/the push
// timer pause for a lull), and every 3rd checkpoint offers a relic instead
// of just resuming. Enemy tokens and hp are placeholder values until the
// 40-enemy roster and real combat stats land — the movement/encounter/
// checkpoint/clash rules themselves are not stubs.
export class WaveSystem {
  private cells: EnemyToken[][] = Array.from({ length: ROWS * COLS }, () => [])
  private bossEnemies: EnemyToken[] = []
  private waveNumber = 1
  private wavesSinceCheckpoint = 0
  private checkpointCount = 0
  private waveStartedAt = Date.now()
  private paused = false
  private readonly changeListeners: Array<() => void> = []
  private readonly encounterListeners: Array<(result: EncounterResult) => void> = []
  private readonly checkpointListeners: Array<(info: CheckpointInfo) => void> = []
  private readonly clashListeners: Array<(info: ClashInfo) => void> = []

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

  onClash(fn: (info: ClashInfo) => void): void {
    this.clashListeners.push(fn)
  }

  getCells(): readonly EnemyToken[][] {
    return this.cells
  }

  getBossEnemies(): readonly EnemyToken[] {
    return this.bossEnemies
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
    const indices: number[] = []
    this.cells.forEach((list, index) => {
      if (list.length > 0) indices.push(index)
    })
    if (this.bossEnemies.length > 0) indices.push(BOSS_CELL_INDEX)
    return indices
  }

  /** Called once the player acknowledges a checkpoint (proceed button, or
   * after picking a relic) — restarts the push timer. */
  resumeFromCheckpoint(): void {
    this.paused = false
    this.waveStartedAt = Date.now()
    this.schedulePush()
  }

  /** Player abilities land here — basic attack targets one cell (or the
   * boss room), the ultimate calls this once per alive slot. Always hits
   * the front of that slot's queue. Returns null on a whiffed shot. */
  applyDamage(cellIndex: number, amount: number): DamageResult | null {
    const list = this.listFor(cellIndex)
    const enemy = list[0]
    if (!enemy) return null
    return this.damageEnemy(list, cellIndex, enemy, amount, cellIndex === BOSS_CELL_INDEX)
  }

  private listFor(cellIndex: number): EnemyToken[] {
    return cellIndex === BOSS_CELL_INDEX ? this.bossEnemies : this.cells[cellIndex]
  }

  private damageEnemy(
    list: EnemyToken[],
    cellIndex: number,
    enemy: EnemyToken,
    amount: number,
    viaBossRoom: boolean
  ): DamageResult {
    enemy.hp -= amount
    if (enemy.hp <= 0) {
      const i = list.indexOf(enemy)
      if (i >= 0) list.splice(i, 1)
      const dropCard = Math.random() < CARD_DROP_CHANCE
      const dropItem = Math.random() < ITEM_DROP_CHANCE
      this.emitChange()
      this.emitEncounter({ cellIndex, dropCard, dropItem, viaBossRoom })
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
    // Snapshot [cellIndex, enemy] pairs up front so an enemy that moves
    // this tick isn't stepped a second time.
    const toStep: Array<[number, EnemyToken]> = []
    this.cells.forEach((list, index) => {
      for (const enemy of list) toStep.push([index, enemy])
    })

    for (const [index, enemy] of toStep) this.stepEnemy(index, enemy)
    this.resolveClashes()
    this.emitChange()
  }

  private stepEnemy(index: number, enemy: EnemyToken): void {
    // A defender shares this cell — stand and fight instead of wandering
    // off; resolveClashes() handles the actual damage trade this tick.
    if (this.defenders?.getHp(index) != null) return

    const list = this.cells[index]
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
      list.splice(list.indexOf(enemy), 1)
      enemy.row = targetRow
      enemy.col = targetCol
      this.bossEnemies.push(enemy)
      return
    }

    // Enemies move freely into any cell, including defended ones — combat
    // only starts once they actually share it (see resolveClashes()).
    const targetIndex = targetRow * COLS + targetCol
    list.splice(list.indexOf(enemy), 1)
    enemy.row = targetRow
    enemy.col = targetCol
    this.cells[targetIndex].push(enemy)
  }

  /** Wherever a defender and an enemy now occupy the same cell, the front
   * of each queue trades a hit. Runs once per tick after movement. */
  private resolveClashes(): void {
    this.cells.forEach((list, index) => this.resolveClashAt(index, list))
    this.resolveClashAt(BOSS_CELL_INDEX, this.bossEnemies)
  }

  private resolveClashAt(cellIndex: number, enemyList: EnemyToken[]): void {
    const enemy = enemyList[0]
    if (!enemy) return
    const defenderHp = this.defenders?.getHp(cellIndex)
    if (defenderHp === null || defenderHp === undefined) return

    this.defenders?.damage(cellIndex, ENEMY_ATTACK_DAMAGE)
    this.damageEnemy(enemyList, cellIndex, enemy, ALLY_COUNTER_DAMAGE, cellIndex === BOSS_CELL_INDEX)
    this.emitClash({ cellIndex })
  }

  /** Initial board fill only — later waves arrive via pushReinforcements(). */
  private spawnWave(): void {
    this.cells = Array.from({ length: ROWS * COLS }, () => [])
    for (let row = 0; row < ROWS; row += 1) {
      this.cells[row * COLS + ENTRY_COL].push({
        id: `enemy-${this.waveNumber}-${row}`,
        row,
        col: ENTRY_COL,
        hp: ENEMY_BASE_HP,
        maxHp: ENEMY_BASE_HP,
      })
    }
    this.emitChange()
  }

  /** A forced wave push — always adds 3 fresh enemies to the entry column,
   * stacking on top of any stragglers already there. */
  private pushReinforcements(): void {
    this.waveNumber += 1
    for (let row = 0; row < ROWS; row += 1) {
      this.cells[row * COLS + ENTRY_COL].push({
        id: `enemy-${this.waveNumber}-${row}`,
        row,
        col: ENTRY_COL,
        hp: ENEMY_BASE_HP,
        maxHp: ENEMY_BASE_HP,
      })
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

  private emitClash(info: ClashInfo): void {
    for (const fn of this.clashListeners) fn(info)
  }
}
