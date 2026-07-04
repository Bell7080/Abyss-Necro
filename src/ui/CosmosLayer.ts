import type { Soul } from '@systems/GraveyardSystem'

// Per-creature soul-star tint (before/after cyan→amber family). Unknown
// creatures fall back to a soft lavender.
const SOUL_COLORS: Record<string, string> = {
  jellyfish: '#7fe8ff',
  'sea-rabbit': '#9dffc2',
  crab: '#ffcf8a',
}

function soulColor(creatureId: string): string {
  return SOUL_COLORS[creatureId] ?? '#c9b8ff'
}

// Stable pseudo-position from a soul id so a star never jumps between
// re-renders. Two independent hashes → x/y fractions in [0,1].
function hashFractions(id: string): { fx: number; fy: number } {
  let h1 = 2166136261
  let h2 = 5381
  for (let i = 0; i < id.length; i += 1) {
    const c = id.charCodeAt(i)
    h1 = ((h1 ^ c) * 16777619) >>> 0
    h2 = ((h2 << 5) + h2 + c) >>> 0
  }
  return { fx: (h1 % 1000) / 1000, fy: (h2 % 1000) / 1000 }
}

const X_MIN = 4
const X_SPAN = 92
const Y_MIN = 8
const Y_SPAN = 78

// The graveyard made into sky: fallen souls scatter as faint stars across the
// whole screen (over the board and its margins), colored by creature and
// sized by tier (shard small, fragment bigger/brighter). Purely a view of
// GraveyardSystem's soul list — accumulation and cascade live there.
export class CosmosLayer {
  private readonly container: HTMLElement
  private readonly tokens = new Map<string, HTMLElement>()

  constructor(root: HTMLElement) {
    this.container = document.createElement('div')
    this.container.className = 'cosmos-layer'
    this.container.setAttribute('aria-hidden', 'true')
    root.appendChild(this.container)
  }

  /** Viewport point a given soul's star occupies — lets a death animation fly
   * a mote to exactly where the star will settle. */
  pointFor(id: string): { x: number; y: number } {
    const { fx, fy } = hashFractions(id)
    return {
      x: ((X_MIN + fx * X_SPAN) / 100) * window.innerWidth,
      y: ((Y_MIN + fy * Y_SPAN) / 100) * window.innerHeight,
    }
  }

  /** A neutral upper-center anchor for cascade cards that no longer have a
   * surviving soul star to fly from. */
  getAnchorPoint(): { x: number; y: number } {
    return { x: window.innerWidth * 0.5, y: window.innerHeight * 0.28 }
  }

  render(souls: readonly Soul[]): void {
    const seen = new Set<string>()
    for (const s of souls) {
      seen.add(s.id)
      let el = this.tokens.get(s.id)
      if (!el) {
        el = document.createElement('div')
        el.className = 'cosmos-soul'
        const { fx, fy } = hashFractions(s.id)
        el.style.left = `${X_MIN + fx * X_SPAN}%`
        el.style.top = `${Y_MIN + fy * Y_SPAN}%`
        this.container.appendChild(el)
        this.tokens.set(s.id, el)
      }
      el.classList.toggle('is-fragment', s.tier === 'fragment')
      el.style.setProperty('--soul-color', soulColor(s.creatureId))
    }

    for (const [id, el] of this.tokens) {
      if (!seen.has(id)) {
        el.classList.add('is-leaving')
        window.setTimeout(() => el.remove(), 420)
        this.tokens.delete(id)
      }
    }
  }
}
