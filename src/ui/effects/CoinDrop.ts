/**
 * CoinDrop — a kill's guaranteed coin falling to the ground.
 *
 * A small diamond sparkle drops in a short lobbed (howitzer-shell) arc from
 * just above the kill point and lands right on it, flashing a shallow cyan
 * impact ring. Call `onLand` exactly when it visually touches down, so the
 * follow-up BubbleBurst travel to the coin panel starts from the same spot
 * the coin actually landed.
 */

export interface CoinDropOptions {
  /** Fall duration in ms (default 360). */
  duration?: number
  onLand?: () => void
}

const OVERLAY_ID = 'coin-drop-overlay'
const STYLE_ID = 'coin-drop-styles'
const DROP_HEIGHT = 130
const COIN_SVG = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 2.8 14.1 9.9 21.2 12 14.1 14.1 12 21.2 9.9 14.1 2.8 12 9.9 9.9 12 2.8Z" fill="currentColor"/>
</svg>`

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
  z-index: 236;
  pointer-events: none;
  overflow: visible;
}
.coin-drop-piece {
  position: absolute;
  color: #7fe8ff;
  filter: drop-shadow(0 0 6px rgba(127, 232, 255, 0.75));
  will-change: transform, opacity;
  pointer-events: none;
}
.coin-drop-impact {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(150, 230, 255, 0.8), rgba(30, 110, 150, 0.3) 60%, transparent 76%);
  pointer-events: none;
}
`
  document.head.appendChild(style)
}

function spawnImpact(overlay: HTMLElement, x: number, y: number): void {
  const impact = document.createElement('div')
  impact.className = 'coin-drop-impact'
  const size = 40
  impact.style.width = `${size}px`
  impact.style.height = `${size}px`
  impact.style.left = `${x - size / 2}px`
  impact.style.top = `${y - size / 2}px`
  overlay.appendChild(impact)

  const anim = impact.animate(
    [
      { transform: 'scale(0.3)', opacity: 0.9 },
      { transform: 'scale(1.3)', opacity: 0 },
    ],
    { duration: 300, easing: 'ease-out', fill: 'forwards' }
  )
  anim.onfinish = () => impact.remove()
  window.setTimeout(() => impact.remove(), 380)
}

export const CoinDrop = {
  fire(x: number, y: number, opts: CoinDropOptions = {}): void {
    ensureStyles()
    const overlay = getOverlay()
    const duration = opts.duration ?? 360
    const size = 22
    // Slight horizontal drift on the fall so it reads as a lobbed shell
    // landing, not a perfectly straight drop.
    const driftX = (Math.random() - 0.5) * 36
    const startX = x + driftX
    const startY = y - DROP_HEIGHT

    const coin = document.createElement('div')
    coin.className = 'coin-drop-piece'
    coin.innerHTML = COIN_SVG
    coin.style.left = `${startX - size / 2}px`
    coin.style.top = `${startY - size / 2}px`
    overlay.appendChild(coin)

    const anim = coin.animate(
      [
        { transform: 'translate(0px, 0px) rotate(0deg) scale(0.8)', opacity: 1 },
        { transform: `translate(${x - startX}px, ${y - startY}px) rotate(200deg) scale(1)`, opacity: 1 },
      ],
      { duration, easing: 'cubic-bezier(0.55, 0, 1, 0.45)', fill: 'forwards' }
    )

    anim.onfinish = () => {
      coin.remove()
      spawnImpact(overlay, x, y)
      opts.onLand?.()
    }
    window.setTimeout(() => coin.remove(), duration + 200)
  },
}
