// A themed mouse pointer: an elongated heart tilted like a pointer tip — long
// and pointed at the tip, its two lobes flaring out like a mermaid scale —
// in the same cyan→lavender→violet gradient the rest of the abyss UI glows
// in. Applied globally via `*` so it wins over every element's own `cursor`
// declaration (buttons, hexes, cells all set their own `cursor: pointer`).
const CURSOR_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="44" height="52" viewBox="0 0 44 52">
  <defs>
    <linearGradient id="cursorGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#9ff2ff"/>
      <stop offset="55%" stop-color="#b6a2ff"/>
      <stop offset="100%" stop-color="#e2b3ff"/>
    </linearGradient>
    <filter id="cursorGlow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="1.8" result="b"/>
      <feMerge>
        <feMergeNode in="b"/>
        <feMergeNode in="b"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <g transform="translate(24,26) rotate(-28) scale(0.8,1.55)">
    <path d="M0 -8 C -6 -14, -14 -10, -14 -2 C -14 6, -6 10, 0 16 C 6 10, 14 6, 14 -2 C 14 -10, 6 -14, 0 -8 Z"
          fill="url(#cursorGrad)" fill-opacity="0.95"
          stroke="#eaf6ff" stroke-width="1.4" stroke-opacity="0.9"
          filter="url(#cursorGlow)"/>
  </g>
</svg>`.trim()

// Hotspot sits at the shape's sharp tip (near the top-left of the canvas),
// matching where a normal pointer's click-point sits.
const HOTSPOT_X = 8
const HOTSPOT_Y = 7

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
