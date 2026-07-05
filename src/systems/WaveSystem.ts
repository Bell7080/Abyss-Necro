import type { TickManager } from '@core/TickManager'
import type { EnemyToken } from '@entities/EnemyToken'
import { BOSS_CELL_INDEX } from '@systems/BoardConstants'
import type { PassiveEvent } from '@systems/PassiveEvent'
import { getCreature } from '@data/CreatureDefinitions'
import { enemyStatsForLevel } from '@data/Tiers'

const ROWS = 3 // lanes — enemies march straight down their own lane
const COLS = 5 // lane depth — cells an enemy crosses before the boss room
const ENTRY_COL = COLS - 1 // rightmost column — entrance, opposite the boss room
// Fallback per-tick enemy attack, only if a token carries none (all spawned
// enemies now carry their creature-level attack).
const ENEMY_ATTACK_DAMAGE = 1
// Enemy 'regen' passive: hp knit back per free (unengaged) march tick.
const ENEMY_REGEN = 2
// 'devour' passive: attack gained each time this unit eats a kill.
const DEVOUR_GAIN = 1
// Even with an ally guarding the necromancer's room, the front enemy has this
// chance each clash to slip past and strike the player directly instead —
// allies are the priority target, not an absolute shield.
const PLAYER_BYPASS_CHANCE = 0.15
// A boss token spawned at a boss wave (BOSS_EVERY). The final one (isFinal)
// closes the 1st ending when slain/captured; the others are tough, capturable
// mini-bosses that keep the run going.
interface EliteSpawn {
  id: string
  label: string
  hp: number
  attack: number
  isFinal?: boolean
}

// The regular tide, weakest→strongest — the creature at index i is "level i+1".
// The run climbs this ladder slowly (see focusLevel): each creature lingers a
// few waves so you can collect a trio and merge it, building your field up out
// of the low-level ones before the water gets deep. Bosses are drawn separately.
const REGULAR_LADDER = [
  'jellyfish', // 1
  'sea-rabbit', // 2
  'clownfish', // 3
  'shrimp', // 4
  'plankton', // 5
  'starfish', // 6
  'hermit-crab', // 7
  'clam', // 8
  'scallop', // 9
  'axolotl', // 10
  'seahorse', // 11
  'crab', // 12
  'octopus', // 13
  'squid', // 14
]
const MAX_REGULAR_LEVEL = REGULAR_LADDER.length

// Bosses appear every BOSS_EVERY waves, cycling this ladder in order; the last
// (상어) is the FINAL boss that ends the run in victory. Custom labels give each
// a title; their stats scale with the wave (bossForWave), not a fixed table.
const BOSS_LADDER = ['piranha', 'pufferfish', 'marlin', 'whale', 'shark']
const BOSS_LABELS: Record<string, string> = {
  piranha: '굶주린 피라냐',
  pufferfish: '부푼 복어',
  marlin: '질주하는 청새치',
  whale: '심연의 고래',
  shark: '심연의 지배자',
}
// A boss is this much tankier / harder-hitting than the wave's regular tide.
const BOSS_HP_MULT = 2.6
const BOSS_ATK_BONUS = 2

// Pacing: a shop-lull every SHOP_EVERY waves, a boss leading every BOSS_EVERY.
const SHOP_EVERY = 10
const BOSS_EVERY = 30
// Each regular-ladder tier (from tier 2 on) lingers this many waves before the
// next one starts — long enough to actually stack a trio of the new arrival
// too, not just glimpse it.
const TIER_WAVES = 4
// Tier 1 (jellyfish) is the one exception: a deliberately longer opening run
// (no mixing at all) so corpses/hand cards stack up enough for a first
// triple-merge before any variety shows up. Sea-rabbit starts right after.
const FIRST_TIER_WAVES = 8
const PURE_OPENING_WAVES = FIRST_TIER_WAVES
// Capture ("넌 내꺼야!") cuts: an ordinary enemy is claimable at ≤25% hp, an
// elite only at ≤10% — the harder execute that makes sacrificing it a payoff.
const CAPTURE_THRESHOLD = 0.25
const BOSS_CAPTURE_THRESHOLD = 0.1
// Fallback only, used if DefenderHooks isn't wired — DefenderSystem's own
// getAttack() (placed card default or summon's own value) wins normally.
const ALLY_COUNTER_DAMAGE = 2
// A kill either hands over the creature's whole card (25%) or leaves a corpse
// to raise/harvest (75%). Wave-1 enemies are pity-rigged to a card so the
// very first kill always teaches the capture loop.
const CARD_DROP_CHANCE = 0.33
const MOVE_TICK_MS = 1300
// A new wave forces its way in every 30 seconds regardless of clear state —
// this is the actual pacing mechanism, not just a display countdown. If the
// board clears before the timer runs out, the next wave pushes immediately
// instead of waiting out the rest of the interval (see triggerInstantPush).
const WAVE_PUSH_INTERVAL_MS = 30 * 1000
// The lull (shop/relic beat) follows every SHOP_EVERY-th wave; every 3rd such
// lull offers a relic pick instead of the shop (i.e. a relic every 30 waves,
// right after each boss).
const CHECKPOINTS_PER_RELIC = 3
// Clearing the board no longer summons the next wave instantly — a ~5s
// breather keeps rounds readable.
const CLEAR_PUSH_DELAY_MS = 5000
// How long after leaving a cell an enemy still counts as hittable there —
// covers the 0.85s slide-out plus the tail of a mortar already in flight,
// so aiming at where the enemy visibly is doesn't whiff on the model.
const HIT_GRACE_MS = 950

export interface EncounterResult {
  /** Grid cell (or BOSS_CELL_INDEX) the enemy was standing in when it died. */
  cellIndex: number
  /** Which creature died — both card and corpse carry this. */
  creatureId: string
  /** 'card' hands the whole necro card to hand; 'corpse' leaves a raisable
   * body on the cell. */
  outcome: 'card' | 'corpse'
  /** Always true — every kill drops exactly one coin. */
  dropCoin: boolean
  viaBossRoom: boolean
  /** The slain enemy was the final boss — Game ends the run in victory. */
  isFinal: boolean
  /** Cell the enemy was sliding FROM (and when), so a corpse can pick up the
   * enemy's in-flight slide instead of popping in at the destination. */
  fromCellIndex?: number
  movedAt?: number
}

export interface DamageResult {
  cellIndex: number
  amount: number
  defeated: boolean
}

export interface CheckpointInfo {
  checkpointNumber: number
  /** Wave just cleared — drives how good the shop's offers roll (deeper = better). */
  wave: number
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
  /** Enemy cleave: damage every ally in the cell; true if any died. */
  cleaveDamage(cellIndex: number, amount: number): boolean
  /** Front ally's ally-form passive id (for cleave/devour). */
  getFrontAllyPassive(cellIndex: number): string | undefined
  /** Ally devour: grow the front ally's attack after a kill. */
  buffFrontAllyAttack(cellIndex: number, amount: number): void
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

  /** Capture threshold for a specific enemy — bosses need the stricter cut. */
  private captureThreshold(enemy: EnemyToken): number {
    return enemy.isBoss ? BOSS_CAPTURE_THRESHOLD : CAPTURE_THRESHOLD
  }

  /** Whether a cell's front enemy is weak enough to capture ("넌 내꺼야!") —
   * ≤25% hp for a normal enemy, ≤10% for a boss. */
  isCapturable(cellIndex: number): boolean {
    const enemy = this.listFor(cellIndex)[0]
    return !!enemy && enemy.hp / enemy.maxHp <= this.captureThreshold(enemy)
  }

  /** Capture the front enemy of a cell if it's at/below its capture cut — it's
   * claimed whole (no corpse, no coin) and its creatureId returned so Game can
   * hand over a guaranteed card. Returns null if not capturable. */
  captureFrontEnemy(cellIndex: number): { creatureId: string; isFinal: boolean } | null {
    const list = this.listFor(cellIndex)
    const enemy = list[0]
    if (!enemy || enemy.hp / enemy.maxHp > this.captureThreshold(enemy)) return null
    list.shift()
    this.emitChange()
    this.triggerInstantPushIfClear()
    return { creatureId: enemy.creatureId, isFinal: !!enemy.isFinal }
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
    // Enemy passive 'armor': shelled foes shrug off 1 damage per hit — but only
    // on regular enemies. Bosses already carry huge transparent HP; stacking a
    // hidden -1 on top made them read as far tankier than their shown health,
    // so bosses take full damage.
    const armor = !enemy.isBoss && getCreature(enemy.creatureId)?.enemyPassiveId === 'armor' ? 1 : 0
    const total = Math.max(1, amount + amp - armor)
    if (amp > 0) this.emitPassive({ kind: 'spark', cellIndex })

    enemy.hp -= total
    if (enemy.hp <= 0) {
      const i = list.indexOf(enemy)
      if (i >= 0) list.splice(i, 1)
      const outcome: 'card' | 'corpse' =
        enemy.guaranteedCard || Math.random() < CARD_DROP_CHANCE ? 'card' : 'corpse'
      this.emitChange()
      this.emitEncounter({
        cellIndex,
        creatureId: enemy.creatureId,
        outcome,
        dropCoin: true,
        viaBossRoom,
        isFinal: !!enemy.isFinal,
        fromCellIndex: enemy.lastCellIndex,
        movedAt: enemy.lastMovedAt,
      })
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

  private hasBossAlive(): boolean {
    return (
      this.bossEnemies.some((e) => e.isBoss) || this.cells.some((list) => list.some((e) => e.isBoss))
    )
  }

  private handlePushTimeout(): void {
    // Checkpoint first, wave later: after every SHOP_EVERY-th wave the lull
    // begins with the board as-is, and the wave that would have pushed here
    // arrives only when the player proceeds (resumeFromCheckpoint) — no enemies
    // pre-spawning into the rest stop. Keyed off the wave number so the shop
    // always lands on a clean 10/20/30… boundary.
    if (this.waveNumber % SHOP_EVERY === 0) {
      // A boss wave shares its number with a shop lull — don't open the shop
      // while the boss still holds the field. Wait it out (no reinforcements
      // pile on); the lull opens once the boss falls and the board clears.
      if (this.hasBossAlive()) {
        this.schedulePush()
        return
      }
      this.checkpointCount += 1
      this.paused = true
      this.emitCheckpoint({
        checkpointNumber: this.checkpointCount,
        wave: this.waveNumber,
        isRelicCheckpoint: this.checkpointCount % CHECKPOINTS_PER_RELIC === 0,
      })
      return
    }

    this.pushReinforcements()
    this.schedulePush()
  }

  // Board tokens slide to their new cell over 1.15s (see .board-token's
  // transform transition — stretched to nearly fill the tick so movement
  // reads as a continuous creep instead of snap-then-freeze) — resolving
  // clashes immediately would layer the lunge keyframe over an in-flight
  // slide, which reads as the enemy snapping forward then "retreating" when
  // the keyframe releases. Waiting out the slide keeps the two animations
  // sequential; 1.2s still lands safely inside the 1.3s tick.
  private static readonly CLASH_SETTLE_MS = 1200

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

    // Enemy passive 'regen': while marching free (not engaged), soft/regenerating
    // foes knit their wounds — makes chipping them down mid-lane less reliable.
    if (getCreature(enemy.creatureId)?.enemyPassiveId === 'regen' && enemy.hp < enemy.maxHp) {
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + ENEMY_REGEN)
    }

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
    const enemyPass = getCreature(enemy.creatureId)?.enemyPassiveId
    // Enemy passive 'ferocious': predators hit +1 on every strike (ally or player).
    const enemyDamage = (enemy.attack ?? ENEMY_ATTACK_DAMAGE) + (enemyPass === 'ferocious' ? 1 : 0)

    const noDefender = defenderHp === null || defenderHp === undefined
    // An ally guarding the necromancer's room is the priority target, but not
    // an absolute shield — the front enemy occasionally slips past it anyway.
    const bypassesToPlayer =
      cellIndex === BOSS_CELL_INDEX && !noDefender && Math.random() < PLAYER_BYPASS_CHANCE

    if (noDefender || bypassesToPlayer) {
      // No defender in the player room (or the enemy bypassed one) — the
      // front enemy strikes the necromancer directly. Game routes this into
      // PlayerSystem; defeat handling lives there. Grid cells without
      // defenders stay peaceful.
      if (cellIndex === BOSS_CELL_INDEX) {
        this.emitPlayerHit({ damage: enemyDamage })
        this.emitClash({ cellIndex })
      }
      return
    }

    const isBossCell = cellIndex === BOSS_CELL_INDEX
    // Front ally's attack + passive, captured before combat so a mutual kill
    // still lands both blows this tick.
    const allyAttack = this.defenders?.getAttack(cellIndex) ?? ALLY_COUNTER_DAMAGE
    const allyPass = this.defenders?.getFrontAllyPassive(cellIndex)

    // ── enemy strikes the defender(s) ──
    let allyDied: boolean
    if (enemyPass === 'cleave') {
      allyDied = this.defenders?.cleaveDamage(cellIndex, enemyDamage) ?? false
      this.emitPassive({ kind: 'cleave', cellIndex })
    } else {
      allyDied = this.defenders?.damage(cellIndex, enemyDamage) ?? false
    }
    // Enemy devour: eating an ally grows the predator's attack.
    if (allyDied && enemyPass === 'devour') {
      enemy.attack = (enemy.attack ?? ENEMY_ATTACK_DAMAGE) + DEVOUR_GAIN
      this.emitPassive({ kind: 'devour', cellIndex })
    }

    // ── the defender strikes back (front enemy, + cleave splash) ──
    // Snapshot the rest of the stack before the front hit can splice it.
    const splash = allyPass === 'cleave' ? enemyList.slice(1) : []
    const res = this.damageEnemy(enemyList, cellIndex, enemy, allyAttack, isBossCell)
    if (splash.length > 0) {
      for (const other of splash) this.damageEnemy(enemyList, cellIndex, other, allyAttack, isBossCell)
      this.emitPassive({ kind: 'cleave', cellIndex })
    }
    // Ally devour: eating the front enemy grows the defender's attack.
    if (res.defeated && allyPass === 'devour') {
      this.defenders?.buffFrontAllyAttack(cellIndex, DEVOUR_GAIN)
      this.emitPassive({ kind: 'devour', cellIndex })
    }
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

  /** The "focus" creature level for a wave — the deepest regular creature the
   * tide has reached. Tier 1 gets the longer FIRST_TIER_WAVES opening run;
   * every tier after that climbs one step every TIER_WAVES waves (tier 2 from
   * wave 9, tier 3 from wave 13, ...). */
  private focusLevel(wave: number): number {
    if (wave <= FIRST_TIER_WAVES) return 1
    return Math.max(
      1,
      Math.min(MAX_REGULAR_LEVEL, 2 + Math.floor((wave - FIRST_TIER_WAVES - 1) / TIER_WAVES))
    )
  }

  /** How many regular enemies a wave sends — 1:1 with the wave number (wave 1
   * sends 1, wave 2 sends 2, ...), capped only so a very deep run doesn't spawn
   * an unreasonable pile at once. */
  private waveCount(wave: number): number {
    return Math.max(1, Math.min(20, wave))
  }

  /** The wave's regular roster: a new tier doesn't just switch on, it crossfades
   * in against the previous one across its own span (mostly-old → half-half →
   * mostly-new), with a small slice reserved for even older unlocked tiers so
   * the pool still feels varied. The very opening waves skip all of this —
   * pure jellyfish, so a first triple-merge is ready before any other
   * creature shows up at all. */
  private waveRoster(wave: number): string[] {
    const count = this.waveCount(wave)
    if (wave <= PURE_OPENING_WAVES) return Array(count).fill(REGULAR_LADDER[0])
    const focus = this.focusLevel(wave)
    const progress = this.tierProgress(wave, focus)
    const ids: string[] = []
    for (let i = 0; i < count; i += 1) {
      ids.push(REGULAR_LADDER[this.pickRegularLevel(focus, progress) - 1])
    }
    return ids
  }

  /** Wave index (1-based) where the given tier first became the focus. */
  private tierStartWave(focus: number): number {
    if (focus <= 1) return 1
    return FIRST_TIER_WAVES + 1 + (focus - 2) * TIER_WAVES
  }

  /** 0 (this tier just took over) → 1 (about to hand off to the next one) —
   * position within the focus tier's own span, driving the crossfade below. */
  private tierProgress(wave: number, focus: number): number {
    if (focus <= 1) return 1
    const start = this.tierStartWave(focus)
    return Math.max(0, Math.min(1, (wave - start) / (TIER_WAVES - 1)))
  }

  /** Crossfades the focus tier in against the tier right before it — mostly
   * the previous tier at the start of the span, mostly the new one by the
   * end — plus a small constant slice spread across every older unlocked
   * tier so deeper pool stays part of the mix, not just the last two. */
  private pickRegularLevel(focus: number, progress: number): number {
    if (focus <= 1) return 1
    const olderShare = focus >= 3 ? 0.15 : 0
    if (Math.random() < olderShare) return 1 + Math.floor(Math.random() * (focus - 2))
    const newShare = 0.15 + 0.7 * progress
    return Math.random() < newShare ? focus : focus - 1
  }

  /** The boss (if any) that leads this wave — one every BOSS_EVERY waves,
   * cycling BOSS_LADDER; 상어 (last) is the final boss. Stats scale with the
   * wave's focus level so a boss stays a real spike without being fixed-value. */
  private bossForWave(wave: number): EliteSpawn | null {
    if (wave <= 0 || wave % BOSS_EVERY !== 0) return null
    const idx = Math.min(BOSS_LADDER.length - 1, wave / BOSS_EVERY - 1)
    const id = BOSS_LADDER[idx]
    const base = enemyStatsForLevel(this.focusLevel(wave))
    return {
      id,
      label: BOSS_LABELS[id] ?? getCreature(id)?.label ?? '심연의 것',
      hp: Math.round(base.hp * BOSS_HP_MULT),
      attack: base.attack + BOSS_ATK_BONUS,
      isFinal: id === 'shark',
    }
  }

  /** The wave's enemies trickle in one by one with random gaps rather than
   * sliding in as a synchronized block. They're spread across lanes (rows)
   * from a random starting lane so a wave pressures several lanes at once —
   * a rising tide. Each enemy's stats come from its creature level, so a wave
   * introducing a higher-level creature is a real difficulty jump. Pending
   * arrivals are tracked so halt() can cancel them. */
  private spawnWaveStaggered(): void {
    // Previous wave's arrivals have long fired — drop the stale ids.
    this.spawnTimeoutIds = []
    const wave = this.waveNumber
    // Every 30th wave a boss leads the tide; escorts trickle in after.
    const boss = this.bossForWave(wave)
    if (boss) this.spawnElite(boss)
    const roster = this.waveRoster(wave)
    const startLane = Math.floor(Math.random() * ROWS)
    let delay = 0

    roster.forEach((creatureId, i) => {
      const lane = (startLane + i) % ROWS
      const spawn = (): void => {
        const stats = enemyStatsForLevel(getCreature(creatureId)?.level ?? 1)
        this.cells[lane * COLS + ENTRY_COL].push({
          id: `enemy-${wave}-${i}`,
          creatureId,
          row: lane,
          col: ENTRY_COL,
          hp: stats.hp,
          maxHp: stats.hp,
          attack: stats.attack,
          // The very first kill must hand the player a necro card.
          guaranteedCard: wave === 1,
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

  /** An elite enters in the middle lane at the entry column, marching the same
   * path as any enemy — just far tougher and hard-hitting. */
  private spawnElite(def: EliteSpawn): void {
    const lane = Math.floor(ROWS / 2)
    this.cells[lane * COLS + ENTRY_COL].push({
      id: `elite-${this.waveNumber}`,
      creatureId: def.id,
      label: def.label,
      row: lane,
      col: ENTRY_COL,
      hp: def.hp,
      maxHp: def.hp,
      attack: def.attack,
      isBoss: true,
      isFinal: def.isFinal,
      guaranteedCard: true,
    })
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

  private emitPlayerHit(info: PlayerHitInfo): void {
    for (const fn of this.playerHitListeners) fn(info)
  }

  private emitPassive(e: PassiveEvent): void {
    for (const fn of this.passiveListeners) fn(e)
  }
}
