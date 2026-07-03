// Owns the 별빛 currency earned from kills and spent at the checkpoint shop.
export class CoinSystem {
  private coins = 0
  private readonly listeners: Array<(coins: number) => void> = []

  onChange(fn: (coins: number) => void): void {
    this.listeners.push(fn)
  }

  getCoins(): number {
    return this.coins
  }

  addCoins(amount: number): void {
    this.coins += amount
    this.emit()
  }

  /** Shop purchase — returns false (and changes nothing) if unaffordable. */
  spend(amount: number): boolean {
    if (this.coins < amount) return false
    this.coins -= amount
    this.emit()
    return true
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.coins)
  }
}
