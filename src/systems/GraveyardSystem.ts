export type SoulTier = 'shard' | 'fragment'

export interface Soul {
  id: string
  creatureId: string
  label: string
  tier: SoulTier
}

// The cosmos graveyard. Fallen souls accumulate as scattered stars, kept per
// creature: hasty undead and rotted corpses leave a 조각(shard), full tier-1
// allies leave a 파편(fragment). Three same-creature shards condense into a
// fragment, three fragments into a whole tier-1 card — resolved in a cascade
// at the round-end lull (see Game.resumeRun). Higher tiers don't pass through
// here: a fallen 2성/3성 returns a card one tier down straight to hand.
export class GraveyardSystem {
  private souls: Soul[] = []
  private readonly listeners: Array<() => void> = []

  onChange(fn: () => void): void {
    this.listeners.push(fn)
  }

  getSouls(): readonly Soul[] {
    return this.souls
  }

  /** Adds a soul with a caller-supplied id so its scattered star position
   * (derived from the id) can be known before an arrival animation lands. */
  add(soul: Soul): void {
    this.souls.push(soul)
    this.emit()
  }

  addShard(id: string, creatureId: string, label: string): void {
    this.add({ id, creatureId, label, tier: 'shard' })
  }

  addFragment(id: string, creatureId: string, label: string): void {
    this.add({ id, creatureId, label, tier: 'fragment' })
  }

  /** Resolves every complete set: 3 same-creature shards → 1 fragment, then 3
   * same-creature fragments → 1 whole tier-1 card. New fragments from the
   * first pass feed the second. Returns the produced cards (fly them to hand)
   * and mutates the soul field to the leftovers. */
  cascade(): Array<{ creatureId: string; label: string }> {
    // Pass 1: shards → fragments.
    for (const [creatureId, group] of this.groupByCreature('shard')) {
      const made = Math.floor(group.length / 3)
      if (made === 0) continue
      this.removeSouls(group.slice(0, made * 3))
      for (let i = 0; i < made; i += 1) {
        this.souls.push({
          id: `frag-${creatureId}-${this.souls.length}-${i}`,
          creatureId,
          label: group[0].label,
          tier: 'fragment',
        })
      }
    }

    // Pass 2: fragments → whole cards.
    const cards: Array<{ creatureId: string; label: string }> = []
    for (const [creatureId, group] of this.groupByCreature('fragment')) {
      const made = Math.floor(group.length / 3)
      if (made === 0) continue
      this.removeSouls(group.slice(0, made * 3))
      for (let i = 0; i < made; i += 1) cards.push({ creatureId, label: group[0].label })
    }

    if (cards.length > 0 || this.souls.length >= 0) this.emit()
    return cards
  }

  private groupByCreature(tier: SoulTier): Map<string, Soul[]> {
    const groups = new Map<string, Soul[]>()
    for (const s of this.souls) {
      if (s.tier !== tier) continue
      const group = groups.get(s.creatureId) ?? []
      group.push(s)
      groups.set(s.creatureId, group)
    }
    return groups
  }

  private removeSouls(remove: Soul[]): void {
    const ids = new Set(remove.map((s) => s.id))
    this.souls = this.souls.filter((s) => !ids.has(s.id))
  }

  private emit(): void {
    for (const fn of this.listeners) fn()
  }
}
