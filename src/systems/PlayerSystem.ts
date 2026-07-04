const PLAYER_MAX_HP = 18

// The necromancer's own life pool. Enemies that reach the player room and
// find no defender there chip at this every clash tick; reaching zero ends
// the run (Game listens via onDefeat and freezes the world + shows the
// defeat screen). There is no regen — leaked enemies are permanent damage
// until cleared.
export class PlayerSystem {
  private hp = PLAYER_MAX_HP
  private maxHp = PLAYER_MAX_HP
  private defeated = false
  private readonly changeListeners: Array<() => void> = []
  private readonly defeatListeners: Array<() => void> = []

  onChange(fn: () => void): void {
    this.changeListeners.push(fn)
  }

  onDefeat(fn: () => void): void {
    this.defeatListeners.push(fn)
  }

  getHp(): number {
    return this.hp
  }

  getMaxHp(): number {
    return this.maxHp
  }

  /** Epic 심연의 심장: permanently bigger life pool, healed by the growth. */
  increaseMaxHp(amount: number): void {
    this.maxHp += amount
    this.hp = Math.min(this.maxHp, this.hp + amount)
    for (const fn of this.changeListeners) fn()
  }

  isDefeated(): boolean {
    return this.defeated
  }

  damage(amount: number): void {
    if (this.defeated) return
    this.hp = Math.max(0, this.hp - amount)
    for (const fn of this.changeListeners) fn()
    if (this.hp === 0) {
      this.defeated = true
      for (const fn of this.defeatListeners) fn()
    }
  }
}
