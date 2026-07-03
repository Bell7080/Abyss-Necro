// A necromancy card sitting in the player's hand — the captured essence of
// whichever creature dropped it. creatureId looks up its art/label in
// CreatureDefinitions; label is kept as a display fallback.
export interface HandCard {
  id: string
  label: string
  creatureId: string
}
