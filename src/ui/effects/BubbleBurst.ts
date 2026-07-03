/**
 * BubbleBurst — travel-style visual effect for "kill drops a card/item/relic".
 *
 * Flat solid-color pieces from a small palette (no gradients, no glow) —
 * closely follows Unmelting's SquareBurst technique (snappy easing curve,
 * a grow-then-settle scale arc, outward-biased distance, slight per-burst
 * count variance) reinterpreted as circular "bubbles" for the abyss theme
 * instead of Unmelting's squares. `travelTo` carries pieces from an origin
 * point to a target point (the hand's next fan slot, a panel, etc.), arcing
 * upward like they're floating through water; `burstAt` scatters them
 * outward from one point for a stationary pop (e.g. a clash landing). Call
 * `onArrive` to time the actual state change to when the bubbles visually
 * land.
 */

export interface BubbleTravelOptions {
  /** How many bubbles to spawn (default random 9-13, like SquareBurst's variance). */
  count?: number
  /** Travel duration in ms (default 620). */
  duration?: number
  /** Min/max bubble diameter in px (default [9, 18]). */
  size?: [number, number]
  /** Override palette (e.g. gold star essence); defaults to abyss cyan. */
  colors?: string[]
  /** Fired once, timed to when the swarm reaches the target. */
  onArrive?: () => void
}

export interface BubbleBurstOptions {
  /** How many bubbles to spawn (default random 6-9). */
  count?: number
  /** Pop duration in ms (default 340). */
  duration?: number
  /** Min/max bubble diameter in px (default [5, 11]). */
  size?: [number, number]
  /** Max scatter distance in px (default 26) — small, a "shallow" pop. */
  spread?: number
  /** Override palette (e.g. passive-specific colors); defaults to abyss cyan. */
  colors?: string[]
}

const OVERLAY_ID = 'bubble-burst-overlay'
const STYLE_ID = 'bubble-burst-styles'

// Dark-to-light cyan, same cool "abyss" family as the rest of the UI —
// a flat 4-shade set rather than a single gradient sphere.
const PALETTE = ['#0d3a52', '#1f6f8f', '#5fc2dd', '#d9f4ff']

// Unmelting SquareBurst's exact snappy deceleration curve — reused here so
// every flat-color burst across both games shares the same felt timing.
const BURST_EASING = 'cubic-bezier(0.18, 0.78, 0.28, 1)'

function getOverlay(): HTMLElement {
  let el = document.getElementById(OVERLAY_ID)
  if (el) return el
  el = document.createElement('div')
  el.id = OVERLAY_ID
  el.setAttribute('aria-hidden', 'true')
  document.body.appendChild(el)
  return el
}

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
#${OVERLAY_ID} {
  position: fixed;
  inset: 0;
  z-index: 230;
  pointer-events: none;
  overflow: visible;
}
.bubble-burst-piece {
  position: absolute;
  border-radius: 50%;
  will-change: transform, opacity;
  pointer-events: none;
}
`
  document.head.appendChild(style)
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function spawnBubble(
  overlay: HTMLElement,
  originX: number,
  originY: number,
  targetX: number,
  targetY: number,
  duration: number,
  sizeRange: [number, number],
  delay: number,
  colors: string[]
): void {
  const piece = document.createElement('div')
  piece.className = 'bubble-burst-piece'
  const size = rand(sizeRange[0], sizeRange[1])
  const startX = originX + rand(-14, 14)
  const startY = originY + rand(-14, 14)
  // Arc control point sits above the straight line so the swarm floats
  // rather than flying in a flat rush.
  const midX = (originX + targetX) / 2 + rand(-30, 30)
  const midY = Math.min(originY, targetY) - rand(70, 120)

  piece.style.width = `${size}px`
  piece.style.height = `${size}px`
  piece.style.left = `${startX - size / 2}px`
  piece.style.top = `${startY - size / 2}px`
  piece.style.background = colors[Math.floor(Math.random() * colors.length)]
  overlay.appendChild(piece)

  const anim = piece.animate(
    [
      { transform: 'translate(0px, 0px) scale(0.5)', opacity: 0 },
      {
        transform: `translate(${midX - startX}px, ${midY - startY}px) scale(1.05)`,
        opacity: 0.95,
        offset: 0.45,
      },
      {
        transform: `translate(${targetX - startX}px, ${targetY - startY}px) scale(0.6)`,
        opacity: 0,
      },
    ],
    { duration, delay, easing: BURST_EASING, fill: 'forwards' }
  )

  anim.onfinish = () => piece.remove()
  window.setTimeout(() => piece.remove(), duration + delay + 200)
}

function spawnImpactBubble(
  overlay: HTMLElement,
  x: number,
  y: number,
  duration: number,
  sizeRange: [number, number],
  spread: number,
  colors: string[]
): void {
  const piece = document.createElement('div')
  piece.className = 'bubble-burst-piece'
  const size = rand(sizeRange[0], sizeRange[1])
  const angle = rand(0, Math.PI * 2)
  // Bias the radius outward, same as SquareBurst, so the pop reads as a
  // chunky ring rather than a tight cluster collapsing on itself.
  const distance = rand(spread * 0.35, spread)
  const dx = Math.cos(angle) * distance
  const dy = Math.sin(angle) * distance

  piece.style.width = `${size}px`
  piece.style.height = `${size}px`
  piece.style.left = `${x - size / 2}px`
  piece.style.top = `${y - size / 2}px`
  piece.style.background = colors[Math.floor(Math.random() * colors.length)]
  overlay.appendChild(piece)

  const anim = piece.animate(
    [
      { transform: 'translate(0px, 0px) scale(0.5)', opacity: 1 },
      { transform: `translate(${dx * 0.55}px, ${dy * 0.55}px) scale(1)`, opacity: 0.9, offset: 0.45 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.8)`, opacity: 0 },
    ],
    { duration, easing: BURST_EASING, fill: 'forwards' }
  )

  anim.onfinish = () => piece.remove()
  window.setTimeout(() => piece.remove(), duration + 150)
}

export const BubbleBurst = {
  /** A small stationary pop — used for a clash landing, not a delivery. */
  burstAt(x: number, y: number, opts: BubbleBurstOptions = {}): void {
    ensureStyles()
    const overlay = getOverlay()
    const count = opts.count ?? Math.floor(rand(6, 9))
    const duration = opts.duration ?? 340
    const sizeRange = opts.size ?? [5, 11]
    const spread = opts.spread ?? 26
    const colors = opts.colors ?? PALETTE

    for (let i = 0; i < count; i += 1) {
      spawnImpactBubble(overlay, x, y, duration, sizeRange, spread, colors)
    }
  },

  travelTo(
    originX: number,
    originY: number,
    targetX: number,
    targetY: number,
    opts: BubbleTravelOptions = {}
  ): void {
    ensureStyles()
    const overlay = getOverlay()
    const count = opts.count ?? Math.floor(rand(9, 13))
    const duration = opts.duration ?? 620
    const sizeRange = opts.size ?? [9, 18]
    const colors = opts.colors ?? PALETTE

    for (let i = 0; i < count; i += 1) {
      spawnBubble(overlay, originX, originY, targetX, targetY, duration, sizeRange, rand(0, 90), colors)
    }

    if (opts.onArrive) {
      window.setTimeout(opts.onArrive, duration + 80)
    }
  },
}
