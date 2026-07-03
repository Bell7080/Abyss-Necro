const MAX_COST = 10
const REGEN_TICK_MS = 1200
export const BASIC_ATTACK_COST = 2
export const ULTIMATE_COST = 10

// Owns the player's cost pool. Basic attack fires unconditionally on cell
// click (no arming step) as long as it's affordable; the ultimate only
// fires from its own skill-orb click. This system only decides whether a
// cast is affordable — combat resolution lives in WaveSystem.
export class AbilitySystem {
  private cost = MAX_COST
  private readonly listeners: Array<() => void> = []

  /** Starts cost regen — held off until the player dismisses the intro
   * veil, so the pool isn't quietly ticking up before the run begins. */
  start(): void {
    window.setInterval(() => this.regen(), REGEN_TICK_MS)
  }

  onChange(fn: () => void): void {
    this.listeners.push(fn)
  }

  getCost(): number {
    return this.cost
  }

  getMaxCost(): number {
    return MAX_COST
  }

  canCastBasic(): boolean {
    return this.cost >= BASIC_ATTACK_COST
  }

  canCastUltimate(): boolean {
    return this.cost >= ULTIMATE_COST
  }

  /** Spends the cost for a direct cell-click basic attack. */
  tryCastBasic(): boolean {
    if (!this.canCastBasic()) return false
    this.cost -= BASIC_ATTACK_COST
    this.emit()
    return true
  }

  tryCastUltimate(): boolean {
    if (!this.canCastUltimate()) return false
    this.cost -= ULTIMATE_COST
    this.emit()
    return true
  }

  private regen(): void {
    if (this.cost >= MAX_COST) return
    this.cost = Math.min(MAX_COST, this.cost + 1)
    this.emit()
  }

  private emit(): void {
    for (const fn of this.listeners) fn()
  }
}
