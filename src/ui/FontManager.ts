/**
 * FontManager — single place that owns @font-face registration and the
 * game's primary font family, so no other module reaches for a raw
 * document.head style injection or a hardcoded font-family string.
 */

export interface CustomFontFace {
  family: string
  url: string
  weight?: number | string
  style?: string
}

const STYLE_ELEMENT_ID = 'font-manager-faces'

export class FontManager {
  private static loadedFaces = new Set<string>()
  private static primaryFamily = `system-ui, sans-serif`

  /** Registers a @font-face rule from a Vite-imported asset URL. Idempotent
   * — calling twice with the same family/url/weight/style is a no-op. */
  static loadCustomFont(face: CustomFontFace): void {
    const key = `${face.family}|${face.url}|${face.weight ?? ''}|${face.style ?? ''}`
    if (this.loadedFaces.has(key)) return
    this.loadedFaces.add(key)

    const styleEl = this.ensureStyleElement()
    const rule = `
@font-face {
  font-family: '${face.family}';
  src: url('${face.url}') format('woff2');
  font-weight: ${face.weight ?? 'normal'};
  font-style: ${face.style ?? 'normal'};
  font-display: swap;
}`
    styleEl.appendChild(document.createTextNode(rule))
  }

  /** Sets the application-wide primary font family: exposes it as the
   * --font-family-primary CSS variable and applies it to <body> directly
   * so every element without its own font-family override inherits it. */
  static setPrimaryFamily(family: string): void {
    this.primaryFamily = family
    document.documentElement.style.setProperty('--font-family-primary', family)
    document.body.style.fontFamily = family
  }

  /** Sets the application-wide base font weight on <body> — elements with
   * their own font-weight (counters at 900 etc.) still win. The loaded face
   * may be single-weight; the browser synthesizes bold from it. */
  static setPrimaryWeight(weight: number): void {
    document.body.style.fontWeight = `${weight}`
  }

  static getPrimaryFamily(): string {
    return this.primaryFamily
  }

  private static ensureStyleElement(): HTMLStyleElement {
    let el = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null
    if (!el) {
      el = document.createElement('style')
      el.id = STYLE_ELEMENT_ID
      document.head.appendChild(el)
    }
    return el
  }
}
