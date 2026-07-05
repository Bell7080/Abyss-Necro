export interface TierStats {
  hp: number
  attack: number
}

// Hasty undead (급조) sit below everything — a disposable 체2/공1 wall.
export const RAISED_STATS: TierStats = { hp: 2, attack: 1 }

export const MAX_TIER = 3

// Per-creature LEVEL stat ladder. Every creature owns a distinct level so no
// two mobs share a similar spec — a level is a clearly separate power step.
// Gentle and roughly even end to end (NOT a hard late-game escalation — an
// earlier steeper curve made the tide overwhelming well before the run's real
// late game, since the wave ladder reaches max level by wave ~40). Each level
// is a modest, comparable step up from the last. Indexed 1-based; clamped for
// any level past the table.
const LEVEL_HP = [0, 6, 9, 13, 17, 22, 27, 33, 40, 47, 55, 64, 74, 85, 97]
const LEVEL_ATK = [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 8]

/** Enemy base stats for a creature's level. */
export function enemyStatsForLevel(level: number): TierStats {
  const i = Math.max(1, Math.min(LEVEL_HP.length - 1, Math.floor(level)))
  return { hp: LEVEL_HP[i], attack: LEVEL_ATK[i] }
}

// Merge tier multiplier on the creature's 1성 base — fusing 3 bodies (×3) is
// worth losing the extra blockers, so each tier is ~3.5×.
const TIER_MULT = [0, 1, 3.5, 12.25]

/** Necromanced-ally stats for a creature's level at a merge tier. The sacral
 * form is tankier and actually deals damage (the reward for capturing), and
 * higher-level creatures make stronger allies — the level distinction carries
 * into the 사령 form too. */
export function allyStatsForLevel(level: number, tier: number): TierStats {
  const base = enemyStatsForLevel(level)
  const hp1 = Math.round(base.hp * 1.5)
  const atk1 = Math.round(base.attack * 2.2) + 3
  const m = TIER_MULT[Math.max(1, Math.min(MAX_TIER, Math.floor(tier)))]
  return { hp: Math.round(hp1 * m), attack: Math.round(atk1 * m) }
}

// Sacral-gauge cost to deploy a hand card as a full defender, by tier — the
// stronger the sending, the more sorcery it takes. Item/epic cards are free.
const SUMMON_COST: Record<number, number> = { 1: 3, 2: 6, 3: 8 }

export function summonCost(tier: number): number {
  return SUMMON_COST[tier] ?? SUMMON_COST[1]
}
