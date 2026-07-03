// Owns coin currency earned from kills. Spending it (at a future checkpoint
// shop) isn't implemented yet — this system only accumulates and reports.
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

  private emit(): void {
    for (const fn of this.listeners) fn(this.coins)
  }
}
