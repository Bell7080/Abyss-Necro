/**
 * ClickRipple — a borderless glowing ring that blooms outward from every
 * click/tap and dissolves, with two trailing echoes right behind it for an
 * afterimage feel. Purely decorative, purely global: it listens on the
 * capture phase so it fires no matter what's clicked (a hex, a corpse figure
 * that stops propagation, an overlay button — everything).
 */

const OVERLAY_ID = 'click-ripple-overlay'
const STYLE_ID = 'click-ripple-styles'

// Cyan → violet, matching the rest of the abyss UI's glow language.
const RING_COLORS = ['rgba(150, 225, 255, 0.95)', 'rgba(190, 165, 255, 0.85)', 'rgba(220, 180, 255, 0.7)']
const RING_COUNT = 3
const RING_STAGGER_MS = 90
const RING_DURATION_MS = 620

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
#${OVERLAY_ID} {
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
  overflow: visible;
}
.click-ripple-ring {
  position: absolute;
  top: 0;
  left: 0;
  width: 22px;
  height: 22px;
  margin: -11px 0 0 -11px;
  border-radius: 50%;
  background: transparent;
  will-change: transform, opacity;
}
`
  document.head.appendChild(style)
}

function getOverlay(): HTMLElement {
  let el = document.getElementById(OVERLAY_ID)
  if (el) return el
  el = document.createElement('div')
  el.id = OVERLAY_ID
  el.setAttribute('aria-hidden', 'true')
  document.body.appendChild(el)
  return el
}

function spawnRipple(overlay: HTMLElement, x: number, y: number): void {
  for (let i = 0; i < RING_COUNT; i += 1) {
    const ring = document.createElement('div')
    ring.className = 'click-ripple-ring'
    ring.style.left = `${x}px`
    ring.style.top = `${y}px`
    const color = RING_COLORS[i] ?? RING_COLORS[RING_COLORS.length - 1]
    ring.style.border = `${2 - i * 0.4}px solid ${color}`
    ring.style.boxShadow = `0 0 ${10 - i * 2}px ${color}, 0 0 ${20 - i * 4}px ${color}`
    overlay.appendChild(ring)

    const delay = i * RING_STAGGER_MS
    const anim = ring.animate(
      [
        { transform: 'scale(0.5)', opacity: 0.95 },
        { transform: 'scale(1.4)', opacity: 0.55, offset: 0.45 },
        { transform: 'scale(2.8)', opacity: 0 },
      ],
      { duration: RING_DURATION_MS, delay, easing: 'cubic-bezier(0.15, 0.7, 0.3, 1)', fill: 'forwards' }
    )
    anim.onfinish = () => ring.remove()
    window.setTimeout(() => ring.remove(), RING_DURATION_MS + delay + 200)
  }
}

export const ClickRipple = {
  install(): void {
    ensureStyles()
    const overlay = getOverlay()
    // Capture phase: fires before any target's own stopPropagation() can block it.
    window.addEventListener(
      'pointerdown',
      (e) => {
        spawnRipple(overlay, e.clientX, e.clientY)
      },
      { capture: true }
    )
  },
}
