import type { TickManager } from '@core/TickManager'

const BASE_MAX_GAUGE = 10
// A slow passive trickle so the necromancer is never fully stuck with an
// empty gauge and no way to act. The primary source is kills (chargeFromKill)
// — this only guarantees a floor and keeps the gauge fill creeping visibly.
const REGEN_TICK_MS = 2500
// Gauge granted per enemy slain. Landing the killing blow yourself adds a
// bonus on top (see Game.castBasicAttack) — aggression fuels sorcery.
export const KILL_CHARGE = 2

// The necromancer's four gauge abilities. Basic fires on a bare cell click;
// the other three are toggle skills armed from the hive, then aimed.
export type AbilityId = 'basic' | 'raise' | 'raise-all' | 'capture'

export const ABILITY_COST: Record<AbilityId, number> = {
  basic: 1, // "이거나 먹어라!" — single-cell bubble blast
  raise: 2, // "얘들아…! 막아!" — raise every corpse in a cell
  'raise-all': 10, // "모두 일어나!" — raise every corpse on the field
  capture: 10, // "넌 내꺼야!" — execute a low-hp enemy for a guaranteed card
}

// Owns the sacral gauge — one shared pool every necromantic act draws from,
// so attacking, raising the dead, and capturing all compete for it. Kills
// refill it; a slow trickle keeps it from ever fully starving. This system
// only decides whether a cast is affordable — the effects live in Game.
export class AbilitySystem {
  private maxGauge = BASE_MAX_GAUGE
  private gauge = BASE_MAX_GAUGE
  private lastRegenAt = Date.now()
  private readonly listeners: Array<() => void> = []

  /** Registers the trickle on the shared TickManager — held off until the
   * player dismisses the intro veil. */
  start(tickManager: TickManager): void {
    this.lastRegenAt = Date.now()
    tickManager.register(() => this.regen(), REGEN_TICK_MS)
  }

  onChange(fn: () => void): void {
    this.listeners.push(fn)
  }

  getGauge(): number {
    return this.gauge
  }

  getMaxGauge(): number {
    return this.maxGauge
  }

  costOf(ability: AbilityId): number {
    return ABILITY_COST[ability]
  }

  /** Fractional gauge including live progress toward the next trickle tick —
   * read every frame by the gauge fill so it visibly creeps up in real time.
   * Whole-number rules (can I cast?) use getGauge(). */
  getSmoothGauge(): number {
    if (this.gauge >= this.maxGauge) return this.maxGauge
    const t = Math.min(1, (Date.now() - this.lastRegenAt) / REGEN_TICK_MS)
    return Math.min(this.maxGauge, this.gauge + t)
  }

  canCast(ability: AbilityId): boolean {
    return this.gauge >= ABILITY_COST[ability]
  }

  /** Whether an arbitrary gauge amount is affordable — used for tiered summon
   * costs (placing a hand card as a full defender). */
  canAfford(amount: number): boolean {
    return this.gauge >= amount
  }

  /** Spends an arbitrary gauge amount if affordable (summon cost). */
  spend(amount: number): boolean {
    if (this.gauge < amount) return false
    this.gauge = Math.max(0, this.gauge - amount)
    this.emit()
    return true
  }

  /** Spends an ability's cost if affordable. */
  tryCast(ability: AbilityId): boolean {
    if (!this.canCast(ability)) return false
    this.gauge = Math.max(0, this.gauge - ABILITY_COST[ability])
    this.emit()
    return true
  }

  /** Epic 과부하 문양: permanently deepens the gauge pool (and tops it up). */
  increaseMaxGauge(amount: number): void {
    this.maxGauge += amount
    this.gauge = Math.min(this.maxGauge, this.gauge + amount)
    this.emit()
  }

  /** A kill feeds the gauge — the necromancer grows stronger by slaying. */
  chargeFromKill(amount = KILL_CHARGE): void {
    if (this.gauge >= this.maxGauge) return
    this.gauge = Math.min(this.maxGauge, this.gauge + amount)
    this.emit()
  }

  private regen(): void {
    this.lastRegenAt = Date.now()
    if (this.gauge >= this.maxGauge) return
    this.gauge = Math.min(this.maxGauge, this.gauge + 1)
    this.emit()
  }

  private emit(): void {
    for (const fn of this.listeners) fn()
  }
}
