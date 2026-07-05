import type { Relic } from '@entities/Relic'
import { Icons } from '@ui/Icons'

// Fan geometry — Unmelting's relic-stack math, shrunk for the dock corner:
// cards spread evenly within ±ROT/±SPREAD, and n≤~5 keeps the fixed steps.
const MAX_ROT_STEP = 7
const MAX_SPREAD_STEP = 20
const ROT_RANGE = 18
const SPREAD_RANGE = 52
const EDGE_LIFT = 8

// Bottom-right relic dock, ported from Unmelting's owned-relic fan: relics
// rest as a tight overlapped hand of mini cards and spread open under the
// cursor — the card under the pointer pins as the pivot, lifts and glows,
// and its neighbours splay aside so any relic can be read without a click.
// Display only; RelicSystem owns the state.
export class RelicInventory {
  private readonly panel: HTMLElement
  private readonly stack: HTMLElement

  constructor(root: HTMLElement) {
    this.panel = document.createElement('div')
    this.panel.className = 'relic-panel'
    this.panel.innerHTML = `<div class="relic-panel-title">유물</div>`
    this.stack = document.createElement('div')
    this.stack.className = 'relic-stack'
    this.panel.appendChild(this.stack)
    root.appendChild(this.panel)
    this.initHoverSpread()
  }

  render(relics: readonly Relic[]): void {
    this.stack.innerHTML = ''
    if (relics.length === 0) {
      // Faint socket so the dock still marks where the eventual reward lands.
      const empty = document.createElement('div')
      empty.className = 'relic-empty-socket'
      empty.innerHTML = Icons.relicGem()
      this.stack.appendChild(empty)
      return
    }

    const center = (relics.length - 1) / 2
    const rotStep = center > 0 ? Math.min(MAX_ROT_STEP, ROT_RANGE / center) : 0
    const spreadStep = center > 0 ? Math.min(MAX_SPREAD_STEP, SPREAD_RANGE / center) : 0
    relics.forEach((relic, i) => {
      const offset = i - center
      const lift = center > 0 ? (Math.abs(offset) / center) * EDGE_LIFT : 0
      const card = document.createElement('div')
      card.className = 'relic-fan-card'
      card.style.setProperty('--relic-i', `${i}`)
      card.style.setProperty('--relic-x', `${offset * spreadStep}px`)
      card.style.setProperty('--relic-rot', `${offset * rotStep}deg`)
      card.style.setProperty('--relic-y', `${lift}px`)
      card.title = relic.label
      card.innerHTML = `<div class="relic-fan-art">${Icons.relicGem()}</div><div class="relic-fan-name">${relic.label}</div>`
      this.stack.appendChild(card)
    })
  }

  /** Cursor-tracked spread (Unmelting relic-stack port): transform-origin
   * rotation does most of the fanning; the pivot card is snapped to a whole
   * index so the hovered card doesn't jitter under a moving mouse. Listeners
   * live on the persistent stack element, so re-renders need no re-attach. */
  private initHoverSpread(): void {
    const applyFocus = (ev: MouseEvent): void => {
      const cards = Array.from(this.stack.querySelectorAll<HTMLElement>('.relic-fan-card'))
      const n = cards.length
      if (n < 2) return
      const rect = this.stack.getBoundingClientRect()
      const t = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width))
      const pivotIdx = Math.round(t * (n - 1))
      cards.forEach((card, i) => {
        const dist = i - pivotIdx
        const isPivot = dist === 0
        card.style.setProperty('--relic-extra-rot', `${dist * 5}deg`)
        card.style.setProperty('--relic-extra-x', `${dist * 9}px`)
        card.style.setProperty('--relic-extra-y', isPivot ? '-10px' : '0px')
        card.style.setProperty('--relic-extra-scale', isPivot ? '0.08' : '0')
        // z-index can't be a CSS calc of --relic-i alone once a pivot exists.
        card.style.zIndex = isPivot ? '100' : ''
        card.classList.toggle('is-pivot', isPivot)
      })
    }

    const clearFocus = (): void => {
      this.stack.classList.remove('is-focus-tracked')
      for (const card of this.stack.querySelectorAll<HTMLElement>('.relic-fan-card')) {
        card.style.removeProperty('--relic-extra-x')
        card.style.removeProperty('--relic-extra-rot')
        card.style.removeProperty('--relic-extra-y')
        card.style.removeProperty('--relic-extra-scale')
        card.style.zIndex = ''
        card.classList.remove('is-pivot')
      }
    }

    this.stack.addEventListener('mouseenter', () => this.stack.classList.add('is-focus-tracked'))
    this.stack.addEventListener('mousemove', applyFocus)
    this.stack.addEventListener('mouseleave', clearFocus)
  }

  /** Viewport point an incoming reward bubble should aim at. */
  getDropPoint(): { x: number; y: number } {
    const rect = this.stack.getBoundingClientRect()
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  }
}
