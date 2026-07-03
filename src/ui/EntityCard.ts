export interface EntityCardOptions {
  variant: 'enemy' | 'player' | 'ally'
  /** Inline SVG string — a flat icon watermark, used only when no real
   * illustration exists yet for this entity (most of the 40-enemy roster). */
  art?: string
  /** Real illustration URL (webp/png) — wins over `art` when set. */
  imageUrl?: string
  name?: string
  /** 0..1. Omit for a static full bar (used where no HP system exists yet). */
  hpRatio?: number
}

// Full-illustration-style card shared by board entities (enemy tokens, the
// player/boss cell, and deployed ally defenders). The bottom bar is
// deliberately numberless — a flowing deep-sea gradient reads as "health"
// without text, per design direction.
export function entityCardHtml(opts: EntityCardOptions): string {
  const hpPercent = Math.round((opts.hpRatio ?? 1) * 100)
  const nameHtml = opts.name ? `<span class="entity-card-name">${opts.name}</span>` : ''
  const artHtml = opts.imageUrl
    ? `<img class="entity-card-image" src="${opts.imageUrl}" alt="" />`
    : (opts.art ?? '')
  const hasImageClass = opts.imageUrl ? ' has-image' : ''

  return `
    <div class="entity-card entity-card--${opts.variant}${hasImageClass}">
      <div class="entity-card-art">${artHtml}</div>
      <div class="entity-card-overlay"></div>
      <div class="entity-card-content">
        ${nameHtml}
        <div class="entity-card-hp"><div class="entity-card-hp-fill" style="width:${hpPercent}%"></div></div>
      </div>
    </div>
  `
}
