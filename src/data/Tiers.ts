export interface TierStats {
  hp: number
  attack: number
}

// Hasty undead (급조) sit below everything — a disposable 체2/공1 wall.
export const RAISED_STATS: TierStats = { hp: 2, attack: 1 }

export const MAX_TIER = 3

// Per-creature LEVEL stat ladder. Every creature owns a distinct level so no
// two mobs share a similar spec — a level is a clearly separate power step.
// The curve is hand-tuned to start gentle and then escalate hard (격등), not
// climb evenly, so a wave introducing a higher-level creature reads as a real
// jump. Indexed 1-based; clamped for any level past the table.
const LEVEL_HP = [0, 6, 10, 15, 22, 32, 45, 62, 84, 112, 148, 194, 252, 326, 420]
const LEVEL_ATK = [0, 1, 1, 2, 2, 3, 3, 4, 5, 6, 7, 9, 11, 13, 16]

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
  const hp1 = Math.round(base.hp * 1.25)
  const atk1 = Math.round(base.attack * 1.8) + 2
  const m = TIER_MULT[Math.max(1, Math.min(MAX_TIER, Math.floor(tier)))]
  return { hp: Math.round(hp1 * m), attack: Math.round(atk1 * m) }
}

// Sacral-gauge cost to deploy a hand card as a full defender, by tier — the
// stronger the sending, the more sorcery it takes. Item/epic cards are free.
const SUMMON_COST: Record<number, number> = { 1: 4, 2: 7, 3: 10 }

export function summonCost(tier: number): number {
  return SUMMON_COST[tier] ?? SUMMON_COST[1]
}
