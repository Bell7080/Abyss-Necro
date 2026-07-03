import type { HandCard } from '@entities/Card'
import { Icons } from '@ui/Icons'

// Fan math shared by render() and getNextSlotPoint() so a bubble aimed at
// "where the next card will land" actually lands where the card appears.
function fanTransform(index: number, total: number): { x: number; y: number; rot: number } {
  const spreadPx = Math.min(480, 46 * total)
  const step = total > 1 ? spreadPx / (total - 1) : 0
  const x = total > 1 ? -spreadPx / 2 + step * index : 0
  const t = total > 1 ? index / (total - 1) : 0.5
  const rot = (t - 0.5) * 36
  const y = -Math.pow((t - 0.5) * 2, 2) * 26
  return { x, y, rot }
}

// Bottom-center fan of cards — reuses Unmelting's relic-fan CSS-variable
// trick (--hand-x/--hand-y/--hand-rot per card) rather than per-card inline
// transforms, so hover/hand-count changes stay pure CSS.
export class CardHand {
  private readonly container: HTMLElement

  constructor(root: HTMLElement) {
    this.container = document.createElement('div')
    this.container.className = 'hand-layer'
    root.appendChild(this.container)
  }

  render(cards: readonly HandCard[]): void {
    this.container.innerHTML = ''
    const total = cards.length
    cards.forEach((card, i) => {
      const el = document.createElement('div')
      el.className = 'hand-card'
      if (i === total - 1) el.classList.add('is-new')
      const { x, y, rot } = fanTransform(i, total)
      el.style.setProperty('--hand-x', `${x}px`)
      el.style.setProperty('--hand-y', `${y}px`)
      el.style.setProperty('--hand-rot', `${rot}deg`)
      el.style.setProperty('--hand-i', `${i}`)
      el.innerHTML = `<div class="hand-card-art">${Icons.enemyToken()}</div><div class="hand-card-label">${card.label}</div>`
      this.container.appendChild(el)
    })
  }

  /** Viewport point the (nextCount)-th card will occupy, for aiming an incoming burst. */
  getNextSlotPoint(nextCount: number): { x: number; y: number } {
    const rect = this.container.getBoundingClientRect()
    const { x, y } = fanTransform(nextCount - 1, nextCount)
    return { x: rect.left + rect.width / 2 + x, y: rect.bottom + y }
  }
}
