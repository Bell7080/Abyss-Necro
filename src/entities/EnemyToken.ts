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
  /** Per-tick damage this enemy deals in a clash / to the player. Defaults to
   * the shared enemy value; a boss hits much harder. */
  attack?: number
  /** Elite token (round mini-boss or the final boss) — bigger card, purple
   * glow, stricter capture cut. */
  isBoss?: boolean
  /** The single final boss (상어) — defeating/capturing it ends the run. */
  isFinal?: boolean
  /** Display name override (e.g. "엘리트 해파리"); falls back to the creature label. */
  label?: string
  /** Cell it most recently left, and when — an attack landing on that cell
   * shortly after the move still hits (generous "it was just there"
   * judgement, see WaveSystem.applyDamage). */
  lastCellIndex?: number
  lastMovedAt?: number
  /** Wave-1 tutorial pity: this kill always drops a necro card. */
  guaranteedCard?: boolean
  /** When this token spawned — while its crawl-in from the fog is still
   * playing (SPAWN_APPROACH_MS) it neither marches nor fights. */
  spawnedAt?: number
}
