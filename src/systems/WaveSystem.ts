import type { TickManager } from '@core/TickManager'
import type { EnemyToken } from '@entities/EnemyToken'
import { BOSS_CELL_INDEX } from '@systems/BoardConstants'
import type { PassiveEvent } from '@systems/PassiveEvent'
import { randomCreature } from '@data/CreatureDefinitions'

const ROWS = 3 // lanes — enemies march straight down their own lane
const COLS = 3
const ENTRY_COL = COLS - 1 // rightmost column — entrance, opposite the boss room
const ENEMY_BASE_HP = 4
const ENEMY_ATTACK_DAMAGE = 1
// Fallback only, used if DefenderHooks isn't wired — DefenderSystem's own
// getAttack() (placed card default or summon's own value) wins normally.
const ALLY_COUNTER_DAMAGE = 2
// Every kill drops exactly one card: a slim epic roll first, then 50/50
// necro vs item (wave-1 enemies are pity-rigged to necro so the very first
// kill always teaches the loop).
const EPIC_DROP_CHANCE = 0.06
const NECRO_DROP_CHANCE = 0.5
const MOVE_TICK_MS = 1300
// A new wave forces its way in every 30 seconds regardless of clear state —
// this is the actual pacing mechanism, not just a display countdown. If the
// board clears before the timer runs out, the next wave pushes immediately
// instead of waiting out the rest of the interval (see triggerInstantPush).
const WAVE_PUSH_INTERVAL_MS = 30 * 1000
// A round is 3 waves; the lull (shop/relic beat) follows each round.
const WAVES_PER_CHECKPOINT = 3
const CHECKPOINTS_PER_RELIC = 3
// Clearing the board no longer summons the next wave instantly — a ~3s
// breather keeps rounds readable.
const CLEAR_PUSH_DELAY_MS = 3000
// How long after leaving a cell an enemy still counts as hittable there —
// covers the 0.85s slide-out plus the tail of a mortar already in flight,
// so aiming at where the enemy visibly is doesn't whiff on the model.
const HIT_GRACE_MS = 950

export interface EncounterResult {
  /** Grid cell (or BOSS_CELL_INDEX) the enemy was standing in when it died. */
  cellIndex: number
  /** Which creature died — a necro drop carries this. */
  creatureId: string
  /** Every kill drops exactly one card — this says which flavor. */
  drop: 'necro' | 'item' | 'epic'
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
  getDamageAmp(cellIndex: number): number
  damage(cellIndex: number, amount: number): boolean
  stepSummons(): void
}

// Lane rush: each grid row is a lane. A wave spawns spread across lanes at
// the far (entry) column and every enemy marches straight down its own lane
// toward the boss room one cell per tick — no wandering, so a wave reads as
// a rising tide bearing down on the player, not a stroll. Any number of
// enemies can stack in a lane cell (they queue); combat starts once an enemy
// and a defender share a cell, and while that fight is on the front enemy
// holds instead of advancing (see stepEnemy's early-out) — that's how a
// defender plugs a lane. Enemies that march off the near edge cross into the
// boss room and stand as a real, attackable threat beside the player, which
// can also hold defenders. A new wave forces in every WAVE_PUSH_INTERVAL_MS;
// every 3 pushes is a checkpoint (movement/push timer pause for a lull), and
// every 3rd checkpoint offers a relic instead of just resuming. Enemy hp is
// a placeholder until the real combat stats land — the movement/encounter/
// checkpoint/clash rules themselves are not stubs.
export class WaveSystem {
  private cells: EnemyToken[][] = Array.from({ length: ROWS * COLS }, () => [])
  private bossEnemies: EnemyToken[] = []
  private waveNumber = 1
  private wavesSinceCheckpoint = 0
  private checkpointCount = 0
  // Trap-star stacks per grid cell — enemies entering pay 1 hp per stack.
  private cellTraps: number[] = Array.from({ length: ROWS * COLS }, () => 0)
  private started = false
  private paused = false
  private pushTimeoutId: number | null = null
  private clashTimeoutId: number | null = null
  private spawnTimeoutIds: number[] = []
  // Push-timer bookkeeping in "effective" (scale-adjusted) time so aim-mode
  // slow motion stretches the countdown too: effective elapsed accumulates
  // at `timeScale` speed from the last mark.
  private timeScale = 1
  private pushEffElapsedMs = 0
  private pushMarkAt = Date.now()
  private readonly changeListeners: Array<() => void> = []
  private readonly encounterListeners: Array<(result: EncounterResult) => void> = []
  private readonly checkpointListeners: Array<(info: CheckpointInfo) => void> = []
  private readonly clashListeners: Array<(info: ClashInfo) => void> = []
  private readonly playerHitListeners: Array<(info: PlayerHitInfo) => void> = []
  private readonly passiveListeners: Array<(e: PassiveEvent) => void> = []

  constructor(private readonly defenders?: DefenderHooks) {}

  /** Spawns the first wave and starts the movement/push timers — held off
   * until the player dismisses the intro veil and clicks "시작하기", so
   * nothing moves or spawns while that screen is up. Movement rides the
   * shared TickManager; the push timer stays a local setTimeout chain since
   * its delay is dynamic (paused/resumed by checkpoints). */
  start(tickManager: TickManager): void {
    if (this.started) return
    this.started = true
    this.spawnWave()
    tickManager.register(() => this.tick(), MOVE_TICK_MS)
    this.schedulePush()
  }

  /** Aim-mode slow motion for the push countdown (movement/regen slow via
   * TickManager.setRate — this covers the wave timer, which lives on its
   * own timeout chain). 1 = normal speed. */
  setTimeScale(scale: number): void {
    if (scale === this.timeScale) return
    const now = Date.now()
    this.pushEffElapsedMs += (now - this.pushMarkAt) * this.timeScale
    this.pushMarkAt = now
    this.timeScale = scale
    if (this.pushTimeoutId !== null) {
      window.clearTimeout(this.pushTimeoutId)
      this.armPushTimeout()
    }
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

  onPassive(fn: (e: PassiveEvent) => void): void {
    this.passiveListeners.push(fn)
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

  getCellTraps(): readonly number[] {
    return this.cellTraps
  }

  /** Per-tick damage an enemy deals — for inspector stat display. */
  getEnemyAttack(): number {
    return ENEMY_ATTACK_DAMAGE
  }

  /** Front enemy of a cell (or the boss room), for inspection. */
  getFrontEnemy(cellIndex: number): EnemyToken | null {
    return this.listFor(cellIndex)[0] ?? null
  }

  /** Epic 함정별: one more permanent trap stack on a grid cell. */
  addCellTrap(cellIndex: number): boolean {
    if (cellIndex === BOSS_CELL_INDEX) return false
    this.cellTraps[cellIndex] += 1
    this.emitChange()
    return true
  }

  isPaused(): boolean {
    return this.paused
  }

  /** Effective (scale-adjusted) milliseconds left until the next forced
   * wave push (HUD only while unpaused). Shows the full interval, unticking,
   * until start() actually begins the run. */
  getRemainingMs(): number {
    if (!this.started) return WAVE_PUSH_INTERVAL_MS
    const running = !this.paused && this.pushTimeoutId !== null
    const eff = this.pushEffElapsedMs + (running ? (Date.now() - this.pushMarkAt) * this.timeScale : 0)
    return Math.max(0, WAVE_PUSH_INTERVAL_MS - eff)
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

  /** Ability damage into a cell — hits the front of that cell's queue. On
   * an empty cell, falls back to a generous "it was just there" judgement:
   * an enemy that left this cell within HIT_GRACE_MS (i.e. its slide-out is
   * still on screen while the mortar lands) is hit in its new cell instead
   * of the shot whiffing. The returned cellIndex is where the hit actually
   * landed, so impact fx can follow the enemy. */
  applyDamage(cellIndex: number, amount: number): DamageResult | null {
    const list = this.listFor(cellIndex)
    const enemy = list[0]
    if (enemy) return this.damageEnemy(list, cellIndex, enemy, amount, cellIndex === BOSS_CELL_INDEX)
    return this.applyGraceDamage(cellIndex, amount)
  }

  /** Board-wide hit (item card "심연 파동"): every enemy on the grid and in
   * the boss room takes the damage. Returns one result per struck enemy so
   * the caller can float numbers over each cell. */
  damageAllEnemies(amount: number): DamageResult[] {
    const results: DamageResult[] = []
    this.cells.forEach((list, index) => {
      for (const enemy of [...list]) {
        results.push(this.damageEnemy(list, index, enemy, amount, false))
      }
    })
    for (const enemy of [...this.bossEnemies]) {
      results.push(this.damageEnemy(this.bossEnemies, BOSS_CELL_INDEX, enemy, amount, true))
    }
    return results
  }

  /** The clicked cell is empty — find the most recent enemy to have left it
   * inside the grace window and hit that one where it now stands. */
  private applyGraceDamage(clickedIndex: number, amount: number): DamageResult | null {
    const now = Date.now()
    let best: { enemy: EnemyToken; list: EnemyToken[]; cellIndex: number } | null = null

    const consider = (enemy: EnemyToken, list: EnemyToken[], cellIndex: number): void => {
      if (enemy.lastCellIndex !== clickedIndex) return
      if (now - (enemy.lastMovedAt ?? 0) > HIT_GRACE_MS) return
      if (!best || (enemy.lastMovedAt ?? 0) > (best.enemy.lastMovedAt ?? 0)) {
        best = { enemy, list, cellIndex }
      }
    }

    this.cells.forEach((list, index) => {
      for (const enemy of list) consider(enemy, list, index)
    })
    for (const enemy of this.bossEnemies) consider(enemy, this.bossEnemies, BOSS_CELL_INDEX)

    if (!best) return null
    const hit: { enemy: EnemyToken; list: EnemyToken[]; cellIndex: number } = best
    return this.damageEnemy(hit.list, hit.cellIndex, hit.enemy, amount, hit.cellIndex === BOSS_CELL_INDEX)
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
    // 감전 점막: a jelly-amp ally in this cell adds to every hit landed here,
    // and sparks a passive blast so the boost reads on screen.
    const amp = this.defenders?.getDamageAmp(cellIndex) ?? 0
    const total = amount + amp
    if (amp > 0) this.emitPassive({ passiveId: 'jelly-amp', cellIndex })

    enemy.hp -= total
    if (enemy.hp <= 0) {
      const i = list.indexOf(enemy)
      if (i >= 0) list.splice(i, 1)
      const drop: 'necro' | 'item' | 'epic' = enemy.guaranteedCard
        ? 'necro'
        : Math.random() < EPIC_DROP_CHANCE
          ? 'epic'
          : Math.random() < NECRO_DROP_CHANCE
            ? 'necro'
            : 'item'
      this.emitChange()
      this.emitEncounter({ cellIndex, creatureId: enemy.creatureId, drop, dropCoin: true, viaBossRoom })
      this.triggerInstantPushIfClear()
      return { cellIndex, amount: total, defeated: true }
    }

    this.emitChange()
    return { cellIndex, amount: total, defeated: false }
  }

  /** Starts a fresh full-interval countdown (new wave / resume). */
  private schedulePush(): void {
    this.pushEffElapsedMs = 0
    this.pushMarkAt = Date.now()
    this.armPushTimeout()
  }

  /** (Re)arms the timeout for whatever effective time remains, stretched by
   * the current time scale — setTimeScale re-arms through here. */
  private armPushTimeout(): void {
    const remaining = Math.max(0, WAVE_PUSH_INTERVAL_MS - this.pushEffElapsedMs) / this.timeScale
    this.pushTimeoutId = window.setTimeout(() => {
      this.pushTimeoutId = null
      this.pushEffElapsedMs = WAVE_PUSH_INTERVAL_MS
      this.handlePushTimeout()
    }, remaining)
  }

  /** Every enemy on the board (grid + boss room) is dead — shorten the wait
   * to a ~3s breather rather than the full push timer (and rather than the
   * old instant slam). */
  private triggerInstantPushIfClear(): void {
    if (this.paused) return
    if (!this.isBoardClear()) return
    if (this.pushTimeoutId !== null) {
      window.clearTimeout(this.pushTimeoutId)
      this.pushTimeoutId = null
    }
    // Re-arm as a short countdown so the HUD keeps reading true and pause/
    // halt paths still find a live timeout to clear.
    this.pushEffElapsedMs = WAVE_PUSH_INTERVAL_MS - CLEAR_PUSH_DELAY_MS
    this.pushMarkAt = Date.now()
    this.armPushTimeout()
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
    // A defender shares this cell — stand and fight instead of advancing;
    // resolveClashes() handles the actual damage trade this tick. This is
    // how a placed defender plugs the lane and stops the march.
    if (this.defenders?.getHp(index) != null) return

    const list = this.cells[index]
    // Lane rush: march one cell toward the boss room every tick, staying in
    // the same lane (row). No wandering — the pressure is the point.
    const targetCol = enemy.col - 1

    if (targetCol < 0) {
      list.splice(list.indexOf(enemy), 1)
      enemy.lastCellIndex = index
      enemy.lastMovedAt = Date.now()
      enemy.col = targetCol
      this.bossEnemies.push(enemy)
      return
    }

    // Enemies advance into any cell, including defended ones downstream —
    // combat only starts once they actually share it (see resolveClashes()).
    const targetIndex = enemy.row * COLS + targetCol
    list.splice(list.indexOf(enemy), 1)
    enemy.lastCellIndex = index
    enemy.lastMovedAt = Date.now()
    enemy.col = targetCol
    this.cells[targetIndex].push(enemy)

    // Trap-star toll: stepping onto a trapped cell costs 1 hp per stack —
    // damageEnemy handles a death here like any other kill (drops included).
    const traps = this.cellTraps[targetIndex]
    if (traps > 0) {
      this.damageEnemy(this.cells[targetIndex], targetIndex, enemy, traps, false)
    }
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

  /** Early-level curve: wave 1 stays a single enemy (necro pity) so the
   * capture loop can be learned in peace; later waves fill lanes to keep the
   * tide bearing down. */
  private enemyCountForWave(wave: number): number {
    if (wave <= 1) return 1
    if (wave === 2) return 2
    if (wave <= 5) return 3
    return 4
  }

  /** The wave's enemies trickle in one by one with random gaps rather than
   * sliding in as a synchronized block. They're spread across lanes (rows)
   * from a random starting lane so a wave pressures several lanes at once —
   * a rising tide. Pending arrivals are tracked so halt() can cancel them. */
  private spawnWaveStaggered(): void {
    // Previous wave's arrivals have long fired — drop the stale ids.
    this.spawnTimeoutIds = []
    const wave = this.waveNumber
    const count = this.enemyCountForWave(wave)
    const startLane = Math.floor(Math.random() * ROWS)
    let delay = 0

    for (let i = 0; i < count; i += 1) {
      const lane = (startLane + i) % ROWS
      const spawn = (): void => {
        this.cells[lane * COLS + ENTRY_COL].push({
          id: `enemy-${wave}-${i}`,
          creatureId: randomCreature().id,
          row: lane,
          col: ENTRY_COL,
          hp: ENEMY_BASE_HP,
          maxHp: ENEMY_BASE_HP,
          // The very first kill must hand the player a necro card.
          guaranteedCard: wave === 1,
        })
        this.emitChange()
      }

      if (i === 0) {
        spawn()
        continue
      }
      delay += 340 + Math.random() * 520
      this.spawnTimeoutIds.push(window.setTimeout(spawn, delay))
    }
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

  private emitPassive(e: PassiveEvent): void {
    for (const fn of this.passiveListeners) fn(e)
  }
}
