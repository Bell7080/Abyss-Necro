/**
 * BubbleBolt — the basic attack projectile ("이거나 먹어라!").
 *
 * A short water-jet: 7~9 solid glowing orbs strung along the line from the
 * necromancer to the target, staggered so they read as one long stream drawing
 * a slight tail. Colors run blue→purple, dark→bright. No shadows or frames —
 * each orb is just a lit circle. The lead orb bursts into a small 팡 on impact.
 */

export interface BubbleBoltOptions {
  duration?: number
  delay?: number
  onImpact?: () => void
}

const OVERLAY_ID = 'bubble-bolt-overlay'
const STYLE_ID = 'bubble-bolt-styles'

// Blue → purple, dark → bright — mixed so the stream shimmers between hues.
const PALETTE = ['#3f57c8', '#5a6fe6', '#6f7bff', '#8a6cf0', '#a06cff', '#c19bff', '#7fc6ff', '#d8c6ff']
const EASING = 'cubic-bezier(0.22, 0.62, 0.3, 1)'
const STEP_MS = 22

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
.bubble-bolt-orb {
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

function pick(): string {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)]
}

/** Glow-only styling: the orb is a solid disc wrapped in two soft same-hue
 * halos — no dark shadow, so it reads as a lit water bead. */
function litOrb(size: number, color: string): HTMLElement {
  const orb = document.createElement('div')
  orb.className = 'bubble-bolt-orb'
  orb.style.width = `${size}px`
  orb.style.height = `${size}px`
  orb.style.background = color
  orb.style.boxShadow = `0 0 ${size * 0.9}px ${color}, 0 0 ${size * 2}px ${color}aa`
  return orb
}

/** Small 팡 where the lead orb lands — a few lit orbs bursting outward. */
function spawnPop(overlay: HTMLElement, x: number, y: number): void {
  const count = Math.floor(rand(7, 10))
  for (let i = 0; i < count; i += 1) {
    const size = rand(7, 13)
    const orb = litOrb(size, pick())
    orb.style.left = `${x - size / 2}px`
    orb.style.top = `${y - size / 2}px`
    overlay.appendChild(orb)
    const angle = (i / count) * Math.PI * 2 + rand(-0.2, 0.2)
    const dist = rand(20, 52)
    const dx = Math.cos(angle) * dist
    const dy = Math.sin(angle) * dist
    const anim = orb.animate(
      [
        { transform: 'translate(0,0) scale(0.5)', opacity: 1 },
        { transform: `translate(${dx * 0.6}px, ${dy * 0.6}px) scale(1)`, opacity: 0.9, offset: 0.45 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.6)`, opacity: 0 },
      ],
      { duration: 360, easing: 'cubic-bezier(0.15, 0.8, 0.25, 1)', fill: 'forwards' }
    )
    anim.onfinish = () => orb.remove()
    window.setTimeout(() => orb.remove(), 520)
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

    const count = Math.floor(rand(7, 10)) // 7~9 orbs
    for (let i = 0; i < count; i += 1) {
      const isLead = i === 0
      // Lead is largest; the trailing orbs taper down to draw the stream's tail.
      const size = isLead ? 21 : Math.max(6, 19 - i * 1.9)
      const orb = litOrb(size, isLead ? '#d8c6ff' : pick())
      orb.style.left = `${originX - size / 2}px`
      orb.style.top = `${originY - size / 2}px`
      overlay.appendChild(orb)

      const orbDelay = delay + i * STEP_MS
      const anim = orb.animate(
        [
          { transform: 'translate(0,0) scale(0.7)', opacity: isLead ? 1 : 0.85 },
          {
            transform: `translate(${dx}px, ${dy}px) scale(${isLead ? 1 : 0.4})`,
            opacity: isLead ? 1 : 0,
          },
        ],
        { duration, delay: orbDelay, easing: EASING, fill: 'forwards' }
      )

      if (isLead) {
        anim.onfinish = () => {
          orb.remove()
          spawnPop(overlay, targetX, targetY)
          opts.onImpact?.()
        }
      } else {
        anim.onfinish = () => orb.remove()
      }
      window.setTimeout(() => orb.remove(), duration + orbDelay + 240)
    }
  },
}
