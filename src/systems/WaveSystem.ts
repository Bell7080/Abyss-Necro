import type { TickManager } from '@core/TickManager'
import type { EnemyToken } from '@entities/EnemyToken'
import { BOSS_CELL_INDEX } from '@systems/BoardConstants'
import { randomCreature } from '@data/CreatureDefinitions'

const ROWS = 3
const COLS = 3
const ENTRY_COL = COLS - 1 // rightmost column — entrance, opposite the boss room
const ENEMY_BASE_HP = 4
const ENEMY_ATTACK_DAMAGE = 1
// Fallback only, used if DefenderHooks isn't wired — DefenderSystem's own
// getAttack() (placed card default or summon's own value) wins normally.
const ALLY_COUNTER_DAMAGE = 2
const CARD_DROP_CHANCE = 0.5
const ITEM_DROP_CHANCE = 0.35
const MOVE_TICK_MS = 1300
// A new wave forces its way in every 30 seconds regardless of clear state —
// this is the actual pacing mechanism, not just a display countdown. If the
// board clears before the timer runs out, the next wave pushes immediately
// instead of waiting out the rest of the interval (see triggerInstantPush).
const WAVE_PUSH_INTERVAL_MS = 30 * 1000
const WAVES_PER_CHECKPOINT = 5
const CHECKPOINTS_PER_RELIC = 3

export interface EncounterResult {
  /** Grid cell (or BOSS_CELL_INDEX) the enemy was standing in when it died. */
  cellIndex: number
  /** Which creature died — the dropped card (if any) carries this. */
  creatureId: string
  dropCard: boolean
  dropItem: boolean
  /** Always true — every kill drops exactly one coin. */
  dropCoin: boolean
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

export interface PlayerHitInfo {
  damage: number
}

// Lets WaveSystem clash with placed defenders (and move ability-summoned
// minions) without holding a reference to DefenderSystem itself — Game.ts
// wires the two together. cellIndex may be BOSS_CELL_INDEX.
export interface DefenderHooks {
  getHp(cellIndex: number): number | null
  getAttack(cellIndex: number): number | null
  damage(cellIndex: number, amount: number): boolean
  stepSummons(): void
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
  private started = false
  private paused = false
  private pushTimeoutId: number | null = null
  private clashTimeoutId: number | null = null
  private spawnTimeoutIds: number[] = []
  private readonly changeListeners: Array<() => void> = []
  private readonly encounterListeners: Array<(result: EncounterResult) => void> = []
  private readonly checkpointListeners: Array<(info: CheckpointInfo) => void> = []
  private readonly clashListeners: Array<(info: ClashInfo) => void> = []
  private readonly playerHitListeners: Array<(info: PlayerHitInfo) => void> = []

  constructor(private readonly defenders?: DefenderHooks) {}

  /** Spawns the first wave and starts the movement/push timers — held off
   * until the player dismisses the intro veil and clicks "시작하기", so
   * nothing moves or spawns while that screen is up. Movement rides the
   * shared TickManager; the push timer stays a local setTimeout chain since
   * its delay is dynamic (paused/resumed by checkpoints). */
  start(tickManager: TickManager): void {
    if (this.started) return
    this.started = true
    this.waveStartedAt = Date.now()
    this.spawnWave()
    tickManager.register(() => this.tick(), MOVE_TICK_MS)
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

  onPlayerHit(fn: (info: PlayerHitInfo) => void): void {
    this.playerHitListeners.push(fn)
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

  /** Milliseconds left until the next forced wave push (HUD only while unpaused).
   * Shows the full interval, unticking, until start() actually begins the run. */
  getRemainingMs(): number {
    if (!this.started) return WAVE_PUSH_INTERVAL_MS
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
   * after picking a relic) — the wave that was held back during the lull
   * arrives now, and the push timer restarts. */
  resumeFromCheckpoint(): void {
    this.paused = false
    this.pushReinforcements()
    this.waveStartedAt = Date.now()
    this.schedulePush()
  }

  /** Defeat: freeze movement/clashes and kill the pending push and any
   * still-staggering spawns so nothing stirs behind the defeat screen.
   * Unlike a checkpoint lull there is no resume — a new run starts from a
   * page reload. */
  halt(): void {
    this.paused = true
    if (this.pushTimeoutId !== null) {
      window.clearTimeout(this.pushTimeoutId)
      this.pushTimeoutId = null
    }
    for (const id of this.spawnTimeoutIds) window.clearTimeout(id)
    this.spawnTimeoutIds = []
  }

  /** Direct single-target/burst damage formula — not currently wired to any
   * ability (basic/ultimate now summon roaming minions instead, see
   * DefenderSystem.summon), kept here for reuse by a future ability/relic.
   * Always hits the front of that cell's queue. Returns null on a whiff. */
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
      this.emitEncounter({ cellIndex, creatureId: enemy.creatureId, dropCard, dropItem, dropCoin: true, viaBossRoom })
      this.triggerInstantPushIfClear()
      return { cellIndex, amount, defeated: true }
    }

    this.emitChange()
    return { cellIndex, amount, defeated: false }
  }

  private schedulePush(): void {
    this.pushTimeoutId = window.setTimeout(() => {
      this.pushTimeoutId = null
      this.handlePushTimeout()
    }, WAVE_PUSH_INTERVAL_MS)
  }

  /** Every enemy on the board (grid + boss room) is dead — don't make the
   * player wait out the rest of the push timer for the next wave. */
  private triggerInstantPushIfClear(): void {
    if (this.paused) return
    if (!this.isBoardClear()) return
    if (this.pushTimeoutId !== null) {
      window.clearTimeout(this.pushTimeoutId)
      this.pushTimeoutId = null
    }
    this.handlePushTimeout()
  }

  private isBoardClear(): boolean {
    return this.bossEnemies.length === 0 && this.cells.every((list) => list.length === 0)
  }

  private handlePushTimeout(): void {
    this.wavesSinceCheckpoint += 1

    // Checkpoint first, wave later: the lull begins with the board as-is,
    // and the wave that would have pushed here arrives only when the player
    // proceeds (resumeFromCheckpoint) — no enemies pre-spawning into the
    // rest stop.
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

    this.pushReinforcements()
    this.waveStartedAt = Date.now()
    this.schedulePush()
  }

  // Board tokens slide to their new cell over 0.85s (see .board-token's
  // transform transition) — resolving clashes immediately would layer the
  // lunge keyframe over an in-flight slide, which reads as the enemy
  // snapping forward then "retreating" when the keyframe releases. Waiting
  // out the slide keeps the two animations sequential; 0.9s still lands
  // safely inside the 1.3s tick.
  private static readonly CLASH_SETTLE_MS = 900

  private tick(): void {
    if (this.paused) return
    // Snapshot [cellIndex, enemy] pairs up front so an enemy that moves
    // this tick isn't stepped a second time.
    const toStep: Array<[number, EnemyToken]> = []
    this.cells.forEach((list, index) => {
      for (const enemy of list) toStep.push([index, enemy])
    })

    for (const [index, enemy] of toStep) this.stepEnemy(index, enemy)
    // Roaming summons move in lockstep with enemies so a summon walking
    // into an enemy's cell this tick is resolved by this same tick's
    // clash check, not a tick late.
    this.defenders?.stepSummons()
    this.emitChange()

    if (this.clashTimeoutId !== null) window.clearTimeout(this.clashTimeoutId)
    this.clashTimeoutId = window.setTimeout(() => {
      this.clashTimeoutId = null
      if (!this.paused) this.resolveClashes()
    }, WaveSystem.CLASH_SETTLE_MS)
  }

  private stepEnemy(index: number, enemy: EnemyToken): void {
    // A defender shares this cell — stand and fight instead of wandering
    // off; resolveClashes() handles the actual damage trade this tick.
    if (this.defenders?.getHp(index) != null) return

    const list = this.cells[index]
    const roll = Math.random()
    let targetRow = enemy.row
    let targetCol = enemy.col

    // Advance chance deliberately under half — with the slower tick this
    // gives the player ~10s before a fresh spawn reaches the room, room to
    // actually aim/deploy instead of being rushed.
    if (roll < 0.4) {
      targetCol = enemy.col - 1 // advance toward the boss room
    } else if (roll < 0.6 && enemy.row > 0) {
      targetRow = enemy.row - 1 // wander up
    } else if (roll < 0.8 && enemy.row < ROWS - 1) {
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

    if (defenderHp === null || defenderHp === undefined) {
      // No defender in the player room — the front enemy strikes the
      // necromancer directly. Game routes this into PlayerSystem; defeat
      // handling lives there. Grid cells without defenders stay peaceful.
      if (cellIndex === BOSS_CELL_INDEX) {
        this.emitPlayerHit({ damage: ENEMY_ATTACK_DAMAGE })
        this.emitClash({ cellIndex })
      }
      return
    }

    // Placed defenders and summons alike report their own attack — a weak
    // summon should hit lighter than a placed card, a strong one harder.
    const allyAttack = this.defenders?.getAttack(cellIndex) ?? ALLY_COUNTER_DAMAGE
    this.defenders?.damage(cellIndex, ENEMY_ATTACK_DAMAGE)
    this.damageEnemy(enemyList, cellIndex, enemy, allyAttack, cellIndex === BOSS_CELL_INDEX)
    this.emitClash({ cellIndex })
  }

  /** Initial board fill only — later waves arrive via pushReinforcements(). */
  private spawnWave(): void {
    this.cells = Array.from({ length: ROWS * COLS }, () => [])
    this.spawnWaveStaggered()
  }

  /** A forced wave push — always adds 3 fresh enemies to the entry column,
   * stacking on top of any stragglers already there. */
  private pushReinforcements(): void {
    this.waveNumber += 1
    this.spawnWaveStaggered()
  }

  /** The wave's 3 enemies trickle in one by one in a random row order with
   * random gaps, instead of all three sliding in as a synchronized block.
   * Pending arrivals are tracked so halt() can cancel them. */
  private spawnWaveStaggered(): void {
    // Previous wave's arrivals have long fired — drop the stale ids.
    this.spawnTimeoutIds = []
    const wave = this.waveNumber
    const rows = [0, 1, 2].sort(() => Math.random() - 0.5)
    let delay = 0

    rows.forEach((row, i) => {
      const spawn = (): void => {
        this.cells[row * COLS + ENTRY_COL].push({
          id: `enemy-${wave}-${row}`,
          creatureId: randomCreature().id,
          row,
          col: ENTRY_COL,
          hp: ENEMY_BASE_HP,
          maxHp: ENEMY_BASE_HP,
        })
        this.emitChange()
      }

      if (i === 0) {
        spawn()
        return
      }
      delay += 340 + Math.random() * 520
      this.spawnTimeoutIds.push(window.setTimeout(spawn, delay))
    })
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

  private emitPlayerHit(info: PlayerHitInfo): void {
    for (const fn of this.playerHitListeners) fn(info)
  }
}
