/**
 * BubbleBurst — travel-style visual effect for "kill drops a card/item/relic".
 *
 * Restyled to match Unmelting's SquareBurst philosophy: flat solid-color
 * pieces from a small palette (no gradients, no glow), so a cluster of
 * overlapping circles reads as a clean layered silhouette rather than a
 * painterly glassy sphere. Unlike SquareBurst (scatters outward from one
 * origin), these travel from an origin point to a target point (the hand's
 * next fan slot, a panel, etc.), arcing upward like they're floating
 * through water. Call `onArrive` to time the actual state change to when
 * the bubbles visually land.
 */

export interface BubbleTravelOptions {
  /** How many bubbles to spawn (default 10). */
  count?: number
  /** Travel duration in ms (default 620). */
  duration?: number
  /** Min/max bubble diameter in px (default [9, 18]). */
  size?: [number, number]
  /** Fired once, timed to when the swarm reaches the target. */
  onArrive?: () => void
}

const OVERLAY_ID = 'bubble-burst-overlay'
const STYLE_ID = 'bubble-burst-styles'

// Dark-to-light cyan, same cool "abyss" family as the rest of the UI —
// a flat 4-shade set rather than a single gradient sphere.
const PALETTE = ['#0d3a52', '#1f6f8f', '#5fc2dd', '#d9f4ff']

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

function pickShade(): string {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)]
}

function spawnBubble(
  overlay: HTMLElement,
  originX: number,
  originY: number,
  targetX: number,
  targetY: number,
  duration: number,
  sizeRange: [number, number],
  delay: number
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
  piece.style.background = pickShade()
  overlay.appendChild(piece)

  const anim = piece.animate(
    [
      { transform: 'translate(0px, 0px) scale(0.4)', opacity: 0 },
      {
        transform: `translate(${midX - startX}px, ${midY - startY}px) scale(1)`,
        opacity: 0.95,
        offset: 0.5,
      },
      {
        transform: `translate(${targetX - startX}px, ${targetY - startY}px) scale(0.5)`,
        opacity: 0,
      },
    ],
    { duration, delay, easing: 'cubic-bezier(0.2, 0.7, 0.25, 1)', fill: 'forwards' }
  )

  anim.onfinish = () => piece.remove()
  window.setTimeout(() => piece.remove(), duration + delay + 200)
}

export const BubbleBurst = {
  travelTo(
    originX: number,
    originY: number,
    targetX: number,
    targetY: number,
    opts: BubbleTravelOptions = {}
  ): void {
    ensureStyles()
    const overlay = getOverlay()
    const count = opts.count ?? 10
    const duration = opts.duration ?? 620
    const sizeRange = opts.size ?? [9, 18]

    for (let i = 0; i < count; i += 1) {
      spawnBubble(overlay, originX, originY, targetX, targetY, duration, sizeRange, rand(0, 90))
    }

    if (opts.onArrive) {
      window.setTimeout(opts.onArrive, duration + 80)
    }
  },
}
