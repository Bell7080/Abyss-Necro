// Placeholder board occupant until the full 40-enemy data table and real
// combat stats exist. Tracks grid position so WaveSystem can move it toward
// the boss room over time, and hp/maxHp so the card's health bar can fill.
// creatureId looks up its illustration/label in CreatureDefinitions.
export interface EnemyToken {
  id: string
  creatureId: string
  row: number
  col: number
  hp: number
  maxHp: number
  /** Cell it most recently left, and when — an attack landing on that cell
   * shortly after the move still hits (generous "it was just there"
   * judgement, see WaveSystem.applyDamage). */
  lastCellIndex?: number
  lastMovedAt?: number
  /** Wave-1 tutorial pity: this kill always drops a necro card. */
  guaranteedCard?: boolean
}
