// A necromancy card sitting in the player's hand — the captured essence of
// whichever creature dropped it. creatureId looks up its art/label in
// CreatureDefinitions; label is kept as a display fallback.
export interface HandCard {
  id: string
  label: string
  creatureId: string
  /** 2 = the result of merging three identical cards. Placeholder rank
   * until the real 20-evolution roster lands — visually distinct in hand,
   * no stat change yet. Undefined = base card. */
  tier?: number
}
