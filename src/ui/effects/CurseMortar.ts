/**
 * CurseMortar — the basic attack / ultimate projectile.
 *
 * A single orb launches from the player's card, arcs steeply overhead (like
 * a mortar shell, not a gentle bow), and slams into the target cell. Calls
 * `onImpact` exactly when the shell visually lands, so damage application
 * and the floating number stay in sync with what's on screen.
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
.curse-mortar-shot {
  position: absolute;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, rgba(255,190,255,0.95), rgba(160,50,175,0.75) 55%, rgba(60,10,70,0.1) 78%);
  box-shadow: 0 0 16px rgba(200,80,225,0.65);
  will-change: transform, opacity;
  pointer-events: none;
}
.curse-mortar-trail {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(200, 100, 220, 0.5);
  filter: blur(1px);
  pointer-events: none;
}
.curse-mortar-impact {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(225,130,255,0.85), rgba(120,20,140,0.3) 60%, transparent 76%);
  pointer-events: none;
}
`
  document.head.appendChild(style)
}

function spawnImpact(overlay: HTMLElement, x: number, y: number): void {
  const impact = document.createElement('div')
  impact.className = 'curse-mortar-impact'
  const size = 64
  impact.style.width = `${size}px`
  impact.style.height = `${size}px`
  impact.style.left = `${x - size / 2}px`
  impact.style.top = `${y - size / 2}px`
  overlay.appendChild(impact)

  const anim = impact.animate(
    [
      { transform: 'scale(0.2)', opacity: 0.9 },
      { transform: 'scale(1.5)', opacity: 0 },
    ],
    { duration: 380, easing: 'ease-out', fill: 'forwards' }
  )
  anim.onfinish = () => impact.remove()
  window.setTimeout(() => impact.remove(), 460)
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
    const size = 18

    const shot = document.createElement('div')
    shot.className = 'curse-mortar-shot'
    shot.style.left = `${originX - size / 2}px`
    shot.style.top = `${originY - size / 2}px`
    shot.style.opacity = '0'
    overlay.appendChild(shot)

    // Steep apex well above the straight line — reads as lobbed artillery,
    // not a flat dart.
    const apexX = (originX + targetX) / 2 + (targetX - originX) * 0.15
    const apexY = Math.min(originY, targetY) - 190

    const anim = shot.animate(
      [
        { transform: 'translate(0px, 0px) scale(0.7)', opacity: 1 },
        {
          transform: `translate(${apexX - originX}px, ${apexY - originY}px) scale(1.05)`,
          opacity: 1,
          offset: 0.5,
        },
        {
          transform: `translate(${targetX - originX}px, ${targetY - originY}px) scale(0.85)`,
          opacity: 1,
        },
      ],
      { duration, delay, easing: 'cubic-bezier(0.42, 0, 0.58, 1)', fill: 'forwards' }
    )

    anim.onfinish = () => {
      shot.remove()
      spawnImpact(overlay, targetX, targetY)
      opts.onImpact?.()
    }
    window.setTimeout(() => shot.remove(), duration + delay + 250)
  },
}
