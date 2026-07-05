/**
 * ClickRipple — a single faint glowing ring that blooms outward from every
 * click/tap and dissolves quickly. Purely decorative, purely global: it
 * listens on the capture phase so it fires no matter what's clicked (a hex, a
 * corpse figure that stops propagation, an overlay button — everything).
 * Kept to one quick, subtle ring — stacked trailing echoes read as a
 * double/triple click, which is misleading for a single-click game.
 */

const OVERLAY_ID = 'click-ripple-overlay'
const STYLE_ID = 'click-ripple-styles'

// Soft cyan, matching the rest of the abyss UI's glow language.
const RING_COLOR = 'rgba(170, 220, 255, 0.5)'
const RING_DURATION_MS = 340

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
  const ring = document.createElement('div')
  ring.className = 'click-ripple-ring'
  ring.style.left = `${x}px`
  ring.style.top = `${y}px`
  ring.style.border = `1.5px solid ${RING_COLOR}`
  ring.style.boxShadow = `0 0 6px ${RING_COLOR}`
  overlay.appendChild(ring)

  const anim = ring.animate(
    [
      { transform: 'scale(0.5)', opacity: 0.6 },
      { transform: 'scale(1.6)', opacity: 0 },
    ],
    { duration: RING_DURATION_MS, easing: 'ease-out', fill: 'forwards' }
  )
  anim.onfinish = () => ring.remove()
  window.setTimeout(() => ring.remove(), RING_DURATION_MS + 200)
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
