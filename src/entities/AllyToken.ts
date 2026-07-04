// Placeholder deployed defender until the 40-card roster/passives exist.
// Created when a hand card is placed on an empty board cell (static —
// row/col/movesLeft stay undefined; creatureId set, looks up the
// necromanced illustration in CreatureDefinitions) or when an ability
// summons a roaming minion (attack/movesLeft set, no creatureId — it's an
// abstract construct, not a captured creature; DefenderSystem moves it each
// tick and removes it once movesLeft runs out, win or lose).
export interface AllyToken {
  id: string
  label: string
  hp: number
  maxHp: number
  creatureId?: string
  attack?: number
  movesLeft?: number
  /** 2 = a 2-star ally made by merging three of the same in one cell. */
  tier?: number
  /** A hasty undead raised from a corpse ("얘들아…! 막아!"): weak, no
   * passive, and purged at the round-end lull. A full necro (placed hand
   * card) has this undefined/false. */
  raised?: boolean
}
