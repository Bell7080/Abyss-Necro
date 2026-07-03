import type { AllyToken } from '@entities/AllyToken'
import { BOSS_CELL_INDEX } from '@systems/BoardConstants'
import type { PassiveEvent } from '@systems/PassiveEvent'
import { getCreature } from '@data/CreatureDefinitions'

const ROWS = 3
const COLS = 3
const CELL_COUNT = ROWS * COLS
const MAX_ALLIES_PER_CELL = 3
const ALLY_BASE_HP = 3
// Fallback attack for allies that don't carry their own value (placed hand
// cards) — summons always set an explicit attack instead.
const DEFAULT_ALLY_ATTACK = 2
// Sea-rabbit death-heal amount to adjacent allies.
const RABBIT_HEAL = 2
// Crab's hard-shell life pool on placement (vs the ALLY_BASE_HP default).
const CRAB_ALLY_HP = 6
// A merged 2-star ally: doubled life, +1 attack over the base card.
const MERGED_ALLY_HP = ALLY_BASE_HP * 2
const MERGED_ALLY_ATTACK = DEFAULT_ALLY_ATTACK + 1

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
  // Epic 증가별 stacks — permanent, applies to every current & future ally.
  private attackBonus = 0
  private readonly listeners: Array<() => void> = []
  private readonly passiveListeners: Array<(e: PassiveEvent) => void> = []
  private readonly deathListeners: Array<(e: AllyDeath) => void> = []

  onChange(fn: () => void): void {
    this.listeners.push(fn)
  }

  onPassive(fn: (e: PassiveEvent) => void): void {
    this.passiveListeners.push(fn)
  }

  /** A creature-ally fell — Game turns it into a graveyard star. */
  onAllyDeath(fn: (e: AllyDeath) => void): void {
    this.deathListeners.push(fn)
  }

  getCells(): readonly AllyToken[][] {
    return this.cells
  }

  getBossAllies(): readonly AllyToken[] {
    return this.bossAllies
  }

  /** Front defender of a cell (or the boss room), for inspection. */
  getFrontAlly(cellIndex: number): AllyToken | null {
    return this.listFor(cellIndex)[0] ?? null
  }

  canPlace(cellIndex: number): boolean {
    return this.listFor(cellIndex).length < MAX_ALLIES_PER_CELL
  }

  place(cellIndex: number, label: string, creatureId: string): boolean {
    if (!this.canPlace(cellIndex)) return false
    // 단단한 등껍질: a crab enters with a bigger life pool (and a shield blast).
    const guarded = getCreature(creatureId)?.passiveId === 'crab-guard'
    const hp = guarded ? CRAB_ALLY_HP : ALLY_BASE_HP
    this.listFor(cellIndex).push({
      id: `ally-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label,
      creatureId,
      hp,
      maxHp: hp,
    })
    this.emit()
    if (guarded) this.emitPassive({ passiveId: 'crab-guard', cellIndex })
    return true
  }

  getHp(cellIndex: number): number | null {
    return this.listFor(cellIndex)[0]?.hp ?? null
  }

  /** Front defender's attack, for WaveSystem to apply on a clash — summons
   * carry their own value, placed cards fall back to the shared default,
   * and the epic 증가별 bonus rides on top of either. */
  getAttack(cellIndex: number): number | null {
    const ally = this.listFor(cellIndex)[0]
    return ally ? (ally.attack ?? DEFAULT_ALLY_ATTACK) + this.attackBonus : null
  }

  /** Epic 증가별: +1 attack for all placed allies, forever. Stackable. */
  addAttackBonus(amount: number): void {
    this.attackBonus += amount
    this.emit()
  }

  /** Item card "치유 물결": every ally in the cell heals, capped at max.
   * Returns false if the cell held no allies (card shouldn't be spent). */
  healCell(cellIndex: number, amount: number): boolean {
    const list = this.listFor(cellIndex)
    if (list.length === 0) return false
    for (const ally of list) ally.hp = Math.min(ally.maxHp, ally.hp + amount)
    this.emit()
    return true
  }

  /** Damage boost enemies take in this cell — sum of jelly-amp (감전 점막)
   * auras from allies standing here. Read by WaveSystem in damageEnemy. */
  getDamageAmp(cellIndex: number): number {
    let amp = 0
    for (const ally of this.listFor(cellIndex)) {
      if (ally.creatureId && getCreature(ally.creatureId)?.passiveId === 'jelly-amp') amp += 1
    }
    return amp
  }

  /** An enemy bumping into this cell calls this. Returns true if the front
   * defender died (freeing a slot). A dying sea-rabbit heals neighbors. */
  damage(cellIndex: number, amount: number): boolean {
    const list = this.listFor(cellIndex)
    const ally = list[0]
    if (!ally) return false
    ally.hp -= amount
    const died = ally.hp <= 0
    if (died) {
      list.shift()
      if (ally.creatureId && getCreature(ally.creatureId)?.passiveId === 'rabbit-heal') {
        this.triggerRabbitHeal(cellIndex)
      }
      // Only captured creatures (not abstract summons) leave a star.
      if (ally.creatureId) {
        this.emitDeath({ creatureId: ally.creatureId, label: ally.label, cellIndex })
      }
    }
    this.emit()
    return died
  }

  /** 폭신 도약: heal every ally in cells adjacent to where the sea-rabbit
   * fell, emitting a passive event per healed cell for the blast. */
  private triggerRabbitHeal(cellIndex: number): void {
    for (const idx of this.adjacentCells(cellIndex)) {
      const list = this.listFor(idx)
      if (list.length === 0) continue
      for (const ally of list) ally.hp = Math.min(ally.maxHp, ally.hp + RABBIT_HEAL)
      this.emitPassive({ passiveId: 'rabbit-heal', cellIndex: idx })
    }
  }

  /** Orthogonal grid neighbors; the boss room heals its own remaining allies. */
  private adjacentCells(cellIndex: number): number[] {
    if (cellIndex === BOSS_CELL_INDEX) return [BOSS_CELL_INDEX]
    const row = Math.floor(cellIndex / COLS)
    const col = cellIndex % COLS
    const out: number[] = []
    if (row > 0) out.push((row - 1) * COLS + col)
    if (row < ROWS - 1) out.push((row + 1) * COLS + col)
    if (col > 0) out.push(row * COLS + (col - 1))
    if (col < COLS - 1) out.push(row * COLS + (col + 1))
    return out
  }

  /** First cell (grid or boss room) holding three identical base allies —
   * the trio the cell-merge button offers to fuse. */
  findCellTriple(): number | null {
    for (let i = 0; i < CELL_COUNT; i += 1) {
      if (this.isSameTriple(this.cells[i])) return i
    }
    if (this.isSameTriple(this.bossAllies)) return BOSS_CELL_INDEX
    return null
  }

  private isSameTriple(list: AllyToken[]): boolean {
    if (list.length !== 3) return false
    const id = list[0].creatureId
    if (!id) return false
    return list.every((a) => a.creatureId === id && a.tier === undefined)
  }

  /** Fuses a same-creature trio in one cell into a single 2-star ally
   * (doubled hp, +1 attack). Returns false if the cell no longer qualifies. */
  mergeCellTriple(cellIndex: number): boolean {
    const list = this.listFor(cellIndex)
    if (!this.isSameTriple(list)) return false
    const base = list[0]
    const merged: AllyToken = {
      id: `ally-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label: base.label,
      creatureId: base.creatureId,
      hp: MERGED_ALLY_HP,
      maxHp: MERGED_ALLY_HP,
      attack: MERGED_ALLY_ATTACK,
      tier: 2,
    }
    list.length = 0
    list.push(merged)
    this.emit()
    return true
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

  private emitPassive(e: PassiveEvent): void {
    for (const fn of this.passiveListeners) fn(e)
  }

  private emitDeath(e: AllyDeath): void {
    for (const fn of this.deathListeners) fn(e)
  }
}

export interface AllyDeath {
  creatureId: string
  label: string
  cellIndex: number
}
