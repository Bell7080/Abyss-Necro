export interface Star {
  id: string
  creatureId: string
  label: string
}

// The graveyard: fallen creature-allies leave a star here (the necromancer
// keeps their essence). Stars accumulate through a round; at round end every
// three of the same creature are reclaimed as one whole card (see Game's
// resume path). Summoned constructs (no creatureId) don't leave stars.
export class GraveyardSystem {
  private stars: Star[] = []
  private readonly listeners: Array<() => void> = []

  onChange(fn: () => void): void {
    this.listeners.push(fn)
  }

  getStars(): readonly Star[] {
    return this.stars
  }

  addStar(creatureId: string, label: string): void {
    this.stars.push({
      id: `star-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      creatureId,
      label,
    })
    this.emit()
  }

  /** How many complete same-creature triples are currently reclaimable. */
  getCombinableCount(): number {
    const counts = new Map<string, number>()
    for (const s of this.stars) counts.set(s.creatureId, (counts.get(s.creatureId) ?? 0) + 1)
    let total = 0
    for (const n of counts.values()) total += Math.floor(n / 3)
    return total
  }

  /** Removes three stars per complete triple and returns one reclaimed card
   * descriptor per triple, so the caller can hand them back as cards. */
  combineTriples(): Array<{ creatureId: string; label: string }> {
    const byCreature = new Map<string, Star[]>()
    for (const s of this.stars) {
      const group = byCreature.get(s.creatureId) ?? []
      group.push(s)
      byCreature.set(s.creatureId, group)
    }

    const reclaimed: Array<{ creatureId: string; label: string }> = []
    const consumed = new Set<string>()
    for (const [creatureId, group] of byCreature) {
      const triples = Math.floor(group.length / 3)
      for (let t = 0; t < triples; t += 1) {
        reclaimed.push({ creatureId, label: group[0].label })
        for (let i = 0; i < 3; i += 1) consumed.add(group[t * 3 + i].id)
      }
    }

    if (consumed.size > 0) {
      this.stars = this.stars.filter((s) => !consumed.has(s.id))
      this.emit()
    }
    return reclaimed
  }

  private emit(): void {
    for (const fn of this.listeners) fn()
  }
}
