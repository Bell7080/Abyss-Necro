// How long an unraised corpse lingers on its cell before it sinks into the
// abyss (~3 movement ticks). On sinking it has a 75% chance to leave a
// graveyard shard; otherwise it's simply gone.
const CORPSE_DECAY_MS = 3800
const NEGLECT_SHARD_CHANCE = 0.75

export interface Corpse {
  id: string
  creatureId: string
  label: string
  cellIndex: number
  /** Where the enemy was sliding from when it fell (and when) — lets the corpse
   * pick up that in-flight slide instead of teleporting to its resting cell. */
  fromCellIndex?: number
  movedAt?: number
}

// Corpses left by slain enemies (75% of kills). They sit on their cell as a
// raisable marker: the "얘들아…! 막아!" / "모두 일어나!" abilities turn them
// into hasty undead defenders, and any left to rot sink on a timer — 75% of
// those still yield a graveyard shard (the necromancer wastes nothing).
// Positional state only; the raising/deception effects live in Game.
export class CorpseSystem {
  private corpses: Corpse[] = []
  private readonly decayTimers = new Map<string, number>()
  private readonly listeners: Array<() => void> = []
  // A neglected corpse sank and left a shard — Game flies it to the graveyard.
  private readonly decayListeners: Array<(c: Corpse) => void> = []

  onChange(fn: () => void): void {
    this.listeners.push(fn)
  }

  onDecayShard(fn: (c: Corpse) => void): void {
    this.decayListeners.push(fn)
  }

  getCorpses(): readonly Corpse[] {
    return this.corpses
  }

  hasAny(): boolean {
    return this.corpses.length > 0
  }

  corpsesInCell(cellIndex: number): Corpse[] {
    return this.corpses.filter((c) => c.cellIndex === cellIndex)
  }

  add(cellIndex: number, creatureId: string, label: string, fromCellIndex?: number, movedAt?: number): void {
    const corpse: Corpse = {
      id: `corpse-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      creatureId,
      label,
      cellIndex,
      fromCellIndex,
      movedAt,
    }
    this.corpses.push(corpse)
    this.decayTimers.set(corpse.id, window.setTimeout(() => this.decay(corpse.id), CORPSE_DECAY_MS))
    this.emit()
  }

  /** Removes and returns up to `max` corpses on a cell — for "얘들아…! 막아!"
   * (capped by the cell's free ally slots so none are wasted). */
  takeCell(cellIndex: number, max = Infinity): Corpse[] {
    const taken = this.corpses.filter((c) => c.cellIndex === cellIndex).slice(0, max)
    if (taken.length === 0) return []
    const takenIds = new Set(taken.map((c) => c.id))
    for (const c of taken) this.clearTimer(c.id)
    this.corpses = this.corpses.filter((c) => !takenIds.has(c.id))
    this.emit()
    return taken
  }

  /** Removes and returns every corpse on the field — for "모두 일어나!". */
  takeAll(): Corpse[] {
    const taken = this.corpses
    for (const c of taken) this.clearTimer(c.id)
    this.corpses = []
    if (taken.length > 0) this.emit()
    return taken
  }

  /** Drops all corpses without raising them (e.g. a full board reset). */
  clear(): void {
    for (const c of this.corpses) this.clearTimer(c.id)
    if (this.corpses.length > 0) {
      this.corpses = []
      this.emit()
    }
  }

  private decay(id: string): void {
    const idx = this.corpses.findIndex((c) => c.id === id)
    if (idx < 0) return
    const [corpse] = this.corpses.splice(idx, 1)
    this.clearTimer(id)
    this.emit()
    if (Math.random() < NEGLECT_SHARD_CHANCE) this.emitDecay(corpse)
  }

  private clearTimer(id: string): void {
    const t = this.decayTimers.get(id)
    if (t !== undefined) {
      window.clearTimeout(t)
      this.decayTimers.delete(id)
    }
  }

  private emit(): void {
    for (const fn of this.listeners) fn()
  }

  private emitDecay(c: Corpse): void {
    for (const fn of this.decayListeners) fn(c)
  }
}
