/**
 * CurseMortar — the basic attack / ultimate projectile.
 *
 * A comet of flat solid-color bubbles: a big lead orb with a tail of
 * smaller, dimmer followers riding the same steep mortar arc at increasing
 * delays, so the volley reads as one clean blast clump trailing bubbles —
 * same flat-palette language as BubbleBurst, violet-magenta family for
 * attacks. Calls `onImpact` exactly when the lead bubble lands, alongside a
 * small flat-piece splash at the impact point.
 */

export interface CurseMortarOptions {
  /** Flight duration in ms (default 520). */
  duration?: number
  /** Delay before launch in ms — used to stagger the ultimate's volley. */
  delay?: number
  onImpact?: () => void
}

const OVERLAY_ID = 'curse-mortar-overlay'
const STYLE_ID = 'curse-mortar-styles'

// Flat attack palette — dark-to-light violet, no gradients on any piece.
const PALETTE = ['#4a1a6a', '#8a3bc0', '#c05ae0', '#f0c7ff']
const EASING = 'cubic-bezier(0.42, 0, 0.58, 1)'
// Lead orb + this many tail bubbles, each smaller and later than the last.
const TAIL_COUNT = 5
const TAIL_STEP_MS = 36

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
.curse-mortar-bubble {
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

/** Small flat-piece splash where the lead bubble lands. */
function spawnImpact(overlay: HTMLElement, x: number, y: number): void {
  const count = Math.floor(rand(6, 9))
  for (let i = 0; i < count; i += 1) {
    const piece = document.createElement('div')
    piece.className = 'curse-mortar-bubble'
    const size = rand(5, 11)
    const angle = rand(0, Math.PI * 2)
    const distance = rand(14, 40)
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
        { transform: 'translate(0px, 0px) scale(0.5)', opacity: 1 },
        { transform: `translate(${dx * 0.55}px, ${dy * 0.55}px) scale(1)`, opacity: 0.9, offset: 0.45 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.8)`, opacity: 0 },
      ],
      { duration: 340, easing: 'cubic-bezier(0.18, 0.78, 0.28, 1)', fill: 'forwards' }
    )
    anim.onfinish = () => piece.remove()
    window.setTimeout(() => piece.remove(), 500)
  }
}

export const CurseMortar = {
  fire(
    originX: number,
    originY: number,
    targetX: number,
    targetY: number,
    opts: CurseMortarOptions = {}
  ): void {
    ensureStyles()
    const overlay = getOverlay()
    const duration = opts.duration ?? 520
    const delay = opts.delay ?? 0

    // Steep apex well above the straight line — reads as lobbed artillery.
    const apexX = (originX + targetX) / 2 + (targetX - originX) * 0.15
    const apexY = Math.min(originY, targetY) - 190

    for (let i = 0; i <= TAIL_COUNT; i += 1) {
      const isLead = i === 0
      const size = isLead ? 20 : 13 - i * 1.6
      const bubble = document.createElement('div')
      bubble.className = 'curse-mortar-bubble'
      bubble.style.width = `${size}px`
      bubble.style.height = `${size}px`
      bubble.style.left = `${originX - size / 2}px`
      bubble.style.top = `${originY - size / 2}px`
      bubble.style.background = isLead ? PALETTE[3] : PALETTE[Math.floor(rand(0, 3))]
      overlay.appendChild(bubble)

      const pieceDelay = delay + i * TAIL_STEP_MS
      const anim = bubble.animate(
        [
          { transform: 'translate(0px, 0px) scale(0.7)', opacity: isLead ? 1 : 0.85 },
          {
            transform: `translate(${apexX - originX}px, ${apexY - originY}px) scale(1)`,
            opacity: isLead ? 1 : 0.7,
            offset: 0.5,
          },
          {
            transform: `translate(${targetX - originX}px, ${targetY - originY}px) scale(${isLead ? 0.85 : 0.4})`,
            opacity: isLead ? 1 : 0,
          },
        ],
        { duration, delay: pieceDelay, easing: EASING, fill: 'forwards' }
      )

      if (isLead) {
        anim.onfinish = () => {
          bubble.remove()
          spawnImpact(overlay, targetX, targetY)
          opts.onImpact?.()
        }
      } else {
        anim.onfinish = () => bubble.remove()
      }
      window.setTimeout(() => bubble.remove(), duration + pieceDelay + 250)
    }
  },
}
