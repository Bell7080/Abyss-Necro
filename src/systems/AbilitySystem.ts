const MAX_COST = 10
const REGEN_TICK_MS = 1200
export const BASIC_ATTACK_COST = 1
export const ULTIMATE_COST = 10

// Owns the player's cost pool and the basic-attack targeting ("armed")
// state. Damage numbers and combat resolution live in WaveSystem — this
// system only decides whether a cast is affordable.
export class AbilitySystem {
  private cost = MAX_COST
  private basicArmed = false
  private readonly listeners: Array<() => void> = []

  constructor() {
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

  isBasicArmed(): boolean {
    return this.basicArmed
  }

  canCastBasic(): boolean {
    return this.cost >= BASIC_ATTACK_COST
  }

  canCastUltimate(): boolean {
    return this.cost >= ULTIMATE_COST
  }

  /** Toggle basic-attack targeting mode; the next board click resolves it. */
  toggleArmBasic(): void {
    this.basicArmed = this.canCastBasic() && !this.basicArmed
    this.emit()
  }

  /** Cancels targeting without spending cost — used when selecting a hand
   * card for placement instead. */
  disarmBasic(): void {
    if (!this.basicArmed) return
    this.basicArmed = false
    this.emit()
  }

  /** Spends the cost and disarms atomically once a target cell is chosen. */
  tryCastBasic(): boolean {
    if (!this.canCastBasic()) return false
    this.cost -= BASIC_ATTACK_COST
    this.basicArmed = false
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
