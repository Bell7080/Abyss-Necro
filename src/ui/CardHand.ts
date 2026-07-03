import { getCreature } from '@data/CreatureDefinitions'
import type { HandCard } from '@entities/Card'
import { Icons } from '@ui/Icons'

// Merge fx beats: outer cards snap onto the core, then the core jellies
// while they dissolve — model swap (and its pop-in) lands at the end.
const MERGE_GATHER_MS = 400
const MERGE_JELLY_MS = 540

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
      el.dataset.cardId = card.id
      const creature = card.kind ? undefined : getCreature(card.creatureId)
      el.className = creature ? 'hand-card has-image' : 'hand-card'
      if (card.kind === 'item') el.classList.add('hand-card--item')
      if (card.kind === 'epic') el.classList.add('hand-card--epic')
      if (card.tier === 2) el.classList.add('hand-card--tier2')
      if (i === total - 1) el.classList.add('is-new')
      if (card.id === selectedId) el.classList.add('is-selected')
      const { x, y, rot } = fanTransform(i, total)
      el.style.setProperty('--hand-x', `${x}px`)
      el.style.setProperty('--hand-y', `${y}px`)
      el.style.setProperty('--hand-rot', `${rot}deg`)
      el.style.setProperty('--hand-i', `${i}`)
      // Necro cards preview the necromanced (after) form — the ally you'll
      // get on placement. Items show a vial, epics a sparkle facility star.
      const artHtml = creature
        ? `<img class="hand-card-image" src="${creature.allyArt}" alt="" />`
        : card.kind === 'item'
          ? Icons.itemVial()
          : card.kind === 'epic'
            ? Icons.coinSparkle()
            : Icons.enemyToken()
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

  /** Unmelting-style jelly merge: the outer two cards magnetize onto the
   * middle one with an elastic snap, the core squashes-and-stretches with a
   * sparkle row while they dissolve into it, then onMerged swaps the model
   * (whose re-render pops the merged card). Display only — card state moves
   * in HandSystem.mergeTriple. */
  playMergeFx(cardIds: string[], onMerged: () => void): void {
    const els = cardIds
      .map((id) => this.container.querySelector<HTMLElement>(`[data-card-id="${id}"]`))
      .filter((el): el is HTMLElement => el !== null)
    if (els.length !== 3) {
      onMerged()
      return
    }

    // Gather onto whichever of the three sits in the middle of the fan.
    const sorted = [...els].sort(
      (a, b) =>
        parseFloat(a.style.getPropertyValue('--hand-x')) -
        parseFloat(b.style.getPropertyValue('--hand-x'))
    )
    const [left, core, right] = sorted
    const coreX = core.style.getPropertyValue('--hand-x')
    const coreY = core.style.getPropertyValue('--hand-y')
    const coreRot = core.style.getPropertyValue('--hand-rot')

    core.classList.add('is-merge-core')
    for (const outer of [left, right]) {
      outer.classList.add('is-merge-gather')
      outer.style.setProperty('--hand-x', coreX)
      outer.style.setProperty('--hand-y', coreY)
      outer.style.setProperty('--hand-rot', coreRot)
    }

    window.setTimeout(() => {
      left.classList.add('is-merge-vanish')
      right.classList.add('is-merge-vanish')
      core.classList.add('is-merge-jelly')
    }, MERGE_GATHER_MS)

    window.setTimeout(onMerged, MERGE_GATHER_MS + MERGE_JELLY_MS)
  }
}
