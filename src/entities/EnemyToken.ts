// Placeholder board occupant until the 40-enemy data table and real combat
// stats exist. Tracks grid position so WaveSystem can move it toward the
// boss room over time, and hp/maxHp so the card's health bar can fill.
export interface EnemyToken {
  id: string
  row: number
  col: number
  hp: number
  maxHp: number
}
