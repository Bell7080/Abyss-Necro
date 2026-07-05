// Floating "-N" damage text, spawned wherever a curse attack lands.
const OVERLAY_ID = 'floating-damage-overlay'
const STYLE_ID = 'floating-damage-styles'

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
  z-index: 240;
  pointer-events: none;
  overflow: visible;
}
.floating-damage-text {
  position: absolute;
  font-family: var(--font-family-primary, system-ui, sans-serif);
  font-weight: 700;
  font-size: 17px;
  color: #ffbdf0;
  text-shadow: 0 0 10px rgba(220, 90, 205, 0.85), 0 2px 4px rgba(0, 0, 0, 0.6);
  pointer-events: none;
  will-change: transform, opacity;
}
`
  document.head.appendChild(style)
}

/** A themed floating label (e.g. "포식! +1" on a devour) — same rise-and-fade
 * as damage numbers but with custom text/color. */
export function showFloatingLabel(x: number, y: number, text: string, color = '#ffe6a2'): void {
  ensureStyles()
  const overlay = getOverlay()
  const el = document.createElement('div')
  el.className = 'floating-damage-text'
  el.textContent = text
  el.style.color = color
  el.style.fontSize = '19px'
  el.style.left = `${x - 16}px`
  el.style.top = `${y - 16}px`
  overlay.appendChild(el)
  const anim = el.animate(
    [
      { transform: 'translateY(4px) scale(0.6)', opacity: 0 },
      { transform: 'translateY(-16px) scale(1.15)', opacity: 1, offset: 0.25 },
      { transform: 'translateY(-58px) scale(1)', opacity: 0 },
    ],
    { duration: 920, easing: 'ease-out', fill: 'forwards' }
  )
  anim.onfinish = () => el.remove()
  window.setTimeout(() => el.remove(), 1000)
}

export function showDamageNumber(x: number, y: number, amount: number): void {
  ensureStyles()
  const overlay = getOverlay()
  const el = document.createElement('div')
  el.className = 'floating-damage-text'
  el.textContent = `-${amount}`
  el.style.left = `${x - 12}px`
  el.style.top = `${y - 14}px`
  overlay.appendChild(el)

  const anim = el.animate(
    [
      { transform: 'translateY(0px) scale(0.7)', opacity: 0 },
      { transform: 'translateY(-14px) scale(1.1)', opacity: 1, offset: 0.2 },
      { transform: 'translateY(-52px) scale(1)', opacity: 0 },
    ],
    { duration: 760, easing: 'ease-out', fill: 'forwards' }
  )
  anim.onfinish = () => el.remove()
  window.setTimeout(() => el.remove(), 900)
}
