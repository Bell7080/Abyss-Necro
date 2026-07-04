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

  /** Drops any placement selection (e.g. when a skill is armed instead). */
  clearSelection(): void {
    if (this.selectedId === null) return
    this.selectedId = null
    this.emit()
  }

  /** Removes a card once it's been placed on the board as a defender. */
  removeCard(cardId: string): void {
    this.cards = this.cards.filter((card) => card.id !== cardId)
    if (this.selectedId === cardId) this.selectedId = null
    this.emit()
  }

  /** First trio of identical same-tier necro cards, if any — merge fodder for
   * 1→2→3성. Item/epic cards never merge; 3성 is the cap. */
  findTriple(): HandCard[] | null {
    const byKey = new Map<string, HandCard[]>()
    for (const card of this.cards) {
      if (card.kind !== undefined) continue
      const tier = card.tier ?? 1
      if (tier >= 3) continue
      const key = `${card.creatureId}:${tier}`
      const group = byKey.get(key) ?? []
      group.push(card)
      if (group.length === 3) return group
      byKey.set(key, group)
    }
    return null
  }

  /** Swaps three cards for their merged result, in one change event. Bails
   * if any of the three left the hand mid-animation (e.g. was placed). */
  mergeTriple(cardIds: string[], merged: HandCard): boolean {
    const present = cardIds.every((id) => this.cards.some((card) => card.id === id))
    if (!present) return false
    this.cards = this.cards.filter((card) => !cardIds.includes(card.id))
    if (this.selectedId && cardIds.includes(this.selectedId)) this.selectedId = null
    this.cards.push(merged)
    this.emit()
    return true
  }

  private emit(): void {
    for (const fn of this.listeners) fn()
  }
}
