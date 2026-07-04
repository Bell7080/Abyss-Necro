/**
 * BubbleBolt — the basic attack projectile ("이거나 먹어라!").
 *
 * A condensed bubble blast that streaks STRAIGHT and fast from the
 * necromancer to the target cell (no lobbed arc), then bursts like a firework
 * on impact. Flat solid-color pieces, violet-magenta family — same palette as
 * BubbleBurst/the old mortar, but the motion reads as a snapped arrow-shot
 * rather than artillery. Calls `onImpact` exactly when the lead orb lands.
 */

export interface BubbleBoltOptions {
  duration?: number
  delay?: number
  onImpact?: () => void
}

const OVERLAY_ID = 'bubble-bolt-overlay'
const STYLE_ID = 'bubble-bolt-styles'

const PALETTE = ['#4a1a6a', '#8a3bc0', '#c05ae0', '#f0c7ff']
const EASING = 'cubic-bezier(0.2, 0.65, 0.3, 1)'
// Lead orb + this many tail bubbles strung out behind it along the line.
const TAIL_COUNT = 4
const TAIL_STEP_MS = 26

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
  z-index: 235;
  pointer-events: none;
  overflow: visible;
}
.bubble-bolt-piece {
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

/** Firework 팡 splash where the lead bubble lands — brighter and wider than
 * the old mortar splash so the shot pays off. */
function spawnBurst(overlay: HTMLElement, x: number, y: number): void {
  const count = Math.floor(rand(10, 14))
  for (let i = 0; i < count; i += 1) {
    const piece = document.createElement('div')
    piece.className = 'bubble-bolt-piece'
    const size = rand(6, 13)
    const angle = (i / count) * Math.PI * 2 + rand(-0.2, 0.2)
    const distance = rand(24, 58)
    const dx = Math.cos(angle) * distance
    const dy = Math.sin(angle) * distance
    piece.style.width = `${size}px`
    piece.style.height = `${size}px`
    piece.style.left = `${x - size / 2}px`
    piece.style.top = `${y - size / 2}px`
    piece.style.background = PALETTE[Math.floor(Math.random() * PALETTE.length)]
    overlay.appendChild(piece)

    const anim = piece.animate(
      [
        { transform: 'translate(0px, 0px) scale(0.4)', opacity: 1 },
        { transform: `translate(${dx * 0.6}px, ${dy * 0.6}px) scale(1)`, opacity: 0.95, offset: 0.4 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.7)`, opacity: 0 },
      ],
      { duration: 380, easing: 'cubic-bezier(0.15, 0.8, 0.25, 1)', fill: 'forwards' }
    )
    anim.onfinish = () => piece.remove()
    window.setTimeout(() => piece.remove(), 560)
  }
}

export const BubbleBolt = {
  fire(originX: number, originY: number, targetX: number, targetY: number, opts: BubbleBoltOptions = {}): void {
    ensureStyles()
    const overlay = getOverlay()
    const duration = opts.duration ?? 300
    const delay = opts.delay ?? 0
    const dx = targetX - originX
    const dy = targetY - originY

    for (let i = 0; i <= TAIL_COUNT; i += 1) {
      const isLead = i === 0
      const size = isLead ? 22 : 14 - i * 2
      const bubble = document.createElement('div')
      bubble.className = 'bubble-bolt-piece'
      bubble.style.width = `${size}px`
      bubble.style.height = `${size}px`
      bubble.style.left = `${originX - size / 2}px`
      bubble.style.top = `${originY - size / 2}px`
      bubble.style.background = isLead ? PALETTE[3] : PALETTE[Math.floor(rand(0, 3))]
      overlay.appendChild(bubble)

      const pieceDelay = delay + i * TAIL_STEP_MS
      const anim = bubble.animate(
        [
          { transform: 'translate(0px, 0px) scale(0.6)', opacity: isLead ? 1 : 0.8 },
          {
            transform: `translate(${dx}px, ${dy}px) scale(${isLead ? 1 : 0.35})`,
            opacity: isLead ? 1 : 0,
          },
        ],
        { duration, delay: pieceDelay, easing: EASING, fill: 'forwards' }
      )

      if (isLead) {
        anim.onfinish = () => {
          bubble.remove()
          spawnBurst(overlay, targetX, targetY)
          opts.onImpact?.()
        }
      } else {
        anim.onfinish = () => bubble.remove()
      }
      window.setTimeout(() => bubble.remove(), duration + pieceDelay + 250)
    }
  },
}
