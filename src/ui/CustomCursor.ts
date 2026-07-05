// A themed mouse pointer: a small, simple triangle, tip at top-left (the
// actual click point, like a normal arrow cursor) — in the same cyan→violet
// gradient the rest of the abyss UI glows in. No outline — just a soft drop
// shadow to lift it off the scene, like a normal cursor's shadow. Applied
// globally via `*` so it wins over every element's own `cursor` declaration
// (buttons, hexes, cells all set their own cursor: pointer).
const CURSOR_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
  <defs>
    <linearGradient id="cursorGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#9ff2ff"/>
      <stop offset="100%" stop-color="#c2a8ff"/>
    </linearGradient>
    <filter id="cursorShadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="1" dy="1" stdDeviation="0.8" flood-color="#050308" flood-opacity="0.55"/>
    </filter>
  </defs>
  <path d="M2 2 L2 17 L12 12 Z" fill="url(#cursorGrad)" filter="url(#cursorShadow)"/>
</svg>`.trim()

// Hotspot sits at the shape's sharp tip (top-left of the canvas), matching
// where a normal pointer's click-point sits.
const HOTSPOT_X = 2
const HOTSPOT_Y = 2

const STYLE_ID = 'custom-cursor-style'

export const CustomCursor = {
  install(): void {
    if (document.getElementById(STYLE_ID)) return
    const dataUri = `data:image/svg+xml,${encodeURIComponent(CURSOR_SVG)}`
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `* { cursor: url("${dataUri}") ${HOTSPOT_X} ${HOTSPOT_Y}, auto !important; }`
    document.head.appendChild(style)
  },
}
