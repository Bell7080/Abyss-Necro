// Ally tier stat ladder (해파리 기준). Each merged tier is ~3.5× the last in
// both hp and attack — a slight premium over merging 3 bodies (×3) so fusing
// is worth losing the extra blockers. Hasty undead (급조) sit below tier 1 as
// disposable 체2/공1 walls. Numbers are starting values, tuned by play.
export interface TierStats {
  hp: number
  attack: number
}

export const RAISED_STATS: TierStats = { hp: 2, attack: 1 }

const TIER_STATS: Record<number, TierStats> = {
  1: { hp: 7, attack: 4 },
  2: { hp: 25, attack: 14 },
  3: { hp: 88, attack: 49 },
}

export const MAX_TIER = 3

export function tierStats(tier: number): TierStats {
  return TIER_STATS[tier] ?? TIER_STATS[1]
}

// Sacral-gauge cost to deploy a hand card as a full defender, by tier — the
// stronger the sending, the more sorcery it takes. Item/epic cards are free.
const SUMMON_COST: Record<number, number> = { 1: 4, 2: 7, 3: 10 }

export function summonCost(tier: number): number {
  return SUMMON_COST[tier] ?? SUMMON_COST[1]
}
