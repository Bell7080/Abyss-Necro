import type { HandCard } from '@entities/Card'

// Owns hand-card state (including which card is selected for placement);
// ui/CardHand only renders whatever this holds.
export class HandSystem {
  private cards: HandCard[] = []
  private selectedId: string | null = null
  private readonly listeners: Array<() => void> = []

  onChange(fn: () => void): void {
    this.listeners.push(fn)
  }

  getCards(): readonly HandCard[] {
    return this.cards
  }

  getSelectedId(): string | null {
    return this.selectedId
  }

  getSelectedCard(): HandCard | null {
    return this.cards.find((card) => card.id === this.selectedId) ?? null
  }

  addCard(card: HandCard): void {
    this.cards.push(card)
    this.emit()
  }

  toggleSelect(cardId: string): void {
    this.selectedId = this.selectedId === cardId ? null : cardId
    this.emit()
  }

  clearSelection(): void {
    if (!this.selectedId) return
    this.selectedId = null
    this.emit()
  }

  /** Removes a card once it's been placed on the board as a defender. */
  removeCard(cardId: string): void {
    this.cards = this.cards.filter((card) => card.id !== cardId)
    if (this.selectedId === cardId) this.selectedId = null
    this.emit()
  }

  private emit(): void {
    for (const fn of this.listeners) fn()
  }
}
