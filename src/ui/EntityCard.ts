export interface EntityCardOptions {
  variant: 'enemy' | 'player'
  /** Inline SVG string — a flat icon standing in as a silhouette watermark
   * until the 40-enemy/player roster has real illustrations. */
  art: string
  name?: string
  /** 0..1. Omit for a static full bar (used where no HP system exists yet). */
  hpRatio?: number
}

// Full-illustration-style card shared by board entities (enemy tokens, the
// player/boss cell, and eventually deployed ally defenders). The bottom bar
// is deliberately numberless — a flowing deep-sea gradient reads as "health"
// without text, per design direction.
export function entityCardHtml(opts: EntityCardOptions): string {
  const hpPercent = Math.round((opts.hpRatio ?? 1) * 100)
  const nameHtml = opts.name ? `<span class="entity-card-name">${opts.name}</span>` : ''

  return `
    <div class="entity-card entity-card--${opts.variant}">
      <div class="entity-card-art">${opts.art}</div>
      <div class="entity-card-overlay"></div>
      <div class="entity-card-content">
        ${nameHtml}
        <div class="entity-card-hp"><div class="entity-card-hp-fill" style="width:${hpPercent}%"></div></div>
      </div>
    </div>
  `
}
