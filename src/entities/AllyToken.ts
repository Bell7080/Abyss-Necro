// Placeholder deployed defender until the 40-card roster/passives exist.
// Created when a hand card is placed on an empty board cell (static —
// row/col/movesLeft stay undefined) or when an ability summons a roaming
// minion (attack/movesLeft set; DefenderSystem moves it each tick and
// removes it once movesLeft runs out, win or lose).
export interface AllyToken {
  id: string
  label: string
  hp: number
  maxHp: number
  attack?: number
  movesLeft?: number
}
