import { Icons } from '@ui/Icons'

const POP_MS = 620

// Top-left coin readout — Unmelting's 불빛/화폐 top-left panel reinterpreted
// in the abyss cool palette. Kills always drop one coin (CoinDrop effect
// lands it on the ground, then BubbleBurst carries it here); pulse() times
// a brief rise-and-glow beat to that arrival.
export class CoinPanel {
  private readonly panel: HTMLElement
  private readonly countEl: HTMLElement

  constructor(root: HTMLElement) {
    this.panel = document.createElement('div')
    this.panel.className = 'coin-panel'

    const icon = document.createElement('span')
    icon.className = 'coin-panel-icon'
    icon.innerHTML = Icons.coinSparkle()

    this.countEl = document.createElement('span')
    this.countEl.className = 'coin-panel-count'
    this.countEl.textContent = '0'

    this.panel.appendChild(icon)
    this.panel.appendChild(this.countEl)
    root.appendChild(this.panel)
  }

  render(coins: number): void {
    this.countEl.textContent = `${coins}`
  }

  /** Rise-and-glow beat, timed to land exactly when a coin's travel-in arrives. */
  pulse(): void {
    this.panel.classList.remove('is-gain')
    // Force reflow so re-adding the class restarts the animation on a
    // rapid second kill instead of no-op'ing.
    void this.panel.offsetWidth
    this.panel.classList.add('is-gain')
    window.setTimeout(() => this.panel.classList.remove('is-gain'), POP_MS)
  }

  /** Viewport point an incoming coin bubble should aim at. */
  getDropPoint(): { x: number; y: number } {
    const rect = this.panel.getBoundingClientRect()
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  }
}
