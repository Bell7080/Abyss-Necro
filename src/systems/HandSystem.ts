import type { HandCard } from '@entities/Card'

// Owns hand-card state; ui/CardHand only renders whatever this holds.
export class HandSystem {
  private cards: HandCard[] = []
  private readonly listeners: Array<(cards: readonly HandCard[]) => void> = []

  onChange(fn: (cards: readonly HandCard[]) => void): void {
    this.listeners.push(fn)
  }

  getCards(): readonly HandCard[] {
    return this.cards
  }

  addCard(card: HandCard): void {
    this.cards.push(card)
    this.emit()
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.cards)
  }
}
