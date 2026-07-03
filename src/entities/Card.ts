// A card sitting in the player's hand. Necro cards (kind undefined/'necro')
// carry the captured essence of a creature and place a defender; item cards
// (kind 'item') are one-shot usables resolved by Game via itemId.
export interface HandCard {
  id: string
  label: string
  /** Empty string for item cards — they have no creature. */
  creatureId: string
  /** Undefined = necro (placeable). 'item' = consumed on use. */
  kind?: 'necro' | 'item'
  /** ItemCardDefinitions id, set only when kind === 'item'. */
  itemId?: string
  /** 2 = the result of merging three identical cards. Placeholder rank
   * until the real 20-evolution roster lands — visually distinct in hand,
   * no stat change yet. Undefined = base card. */
  tier?: number
}
