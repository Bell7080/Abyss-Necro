import { getCreature } from '@data/CreatureDefinitions'
import type { HandCard } from '@entities/Card'
import { Icons } from '@ui/Icons'

// Fan math shared by render() and getNextSlotPoint() so a bubble aimed at
// "where the next card will land" actually lands where the card appears.
// A fixed per-card step (capped so a big hand still fits) keeps a small
// hand gathered in an overlapping stack instead of spreading it out to a
// count-proportional width, and the fan angle/arc grow with the count so
// two cards sit nearly straight rather than splaying like a full hand.
function fanTransform(index: number, total: number): { x: number; y: number; rot: number } {
  const step = total > 1 ? Math.min(74, 620 / (total - 1)) : 0
  const spreadPx = step * (total - 1)
  const x = -spreadPx / 2 + step * index
  const t = total > 1 ? index / (total - 1) : 0.5
  const fanAngle = Math.min(36, 7 * total)
  const rot = (t - 0.5) * fanAngle
  const y = -Math.pow((t - 0.5) * 2, 2) * Math.min(30, 5 * total)
  return { x, y, rot }
}

// Bottom-center fan of cards — reuses Unmelting's relic-fan CSS-variable
// trick (--hand-x/--hand-y/--hand-rot per card) rather than per-card inline
// transforms, so hover/hand-count changes stay pure CSS. Clicking a card
// selects it for placement; Game.ts decides what happens next.
export class CardHand {
  private readonly container: HTMLElement

  constructor(
    root: HTMLElement,
    private readonly onCardClick: (cardId: string) => void
  ) {
    this.container = document.createElement('div')
    this.container.className = 'hand-layer'
    root.appendChild(this.container)
  }

  render(cards: readonly HandCard[], selectedId: string | null): void {
    this.container.innerHTML = ''
    const total = cards.length
    cards.forEach((card, i) => {
      const el = document.createElement('button')
      el.type = 'button'
      const creature = getCreature(card.creatureId)
      el.className = creature ? 'hand-card has-image' : 'hand-card'
      if (i === total - 1) el.classList.add('is-new')
      if (card.id === selectedId) el.classList.add('is-selected')
      const { x, y, rot } = fanTransform(i, total)
      el.style.setProperty('--hand-x', `${x}px`)
      el.style.setProperty('--hand-y', `${y}px`)
      el.style.setProperty('--hand-rot', `${rot}deg`)
      el.style.setProperty('--hand-i', `${i}`)
      // Shows the necromanced (after) form — this is a preview of the ally
      // you'll get when you place it, not the enemy it was captured from.
      const artHtml = creature ? `<img class="hand-card-image" src="${creature.allyArt}" alt="" />` : Icons.enemyToken()
      el.innerHTML = `<div class="hand-card-art">${artHtml}</div><div class="hand-card-label">${card.label}</div>`
      el.addEventListener('click', () => this.onCardClick(card.id))
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
