import { getCreature, getAllyArt } from '@data/CreatureDefinitions'
import { summonCost } from '@data/Tiers'
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

/** Display order: highest star first, and same-creature cards clustered
 * together (so merge progress reads at a glance) — items/epics (no tier)
 * sort after every necro card, grouped by their own kind. */
function sortForDisplay(cards: readonly HandCard[]): HandCard[] {
  return [...cards].sort((a, b) => {
    const tierA = a.kind ? 0 : (a.tier ?? 1)
    const tierB = b.kind ? 0 : (b.tier ?? 1)
    if (tierA !== tierB) return tierB - tierA
    const keyA = a.kind ? `${a.kind}:${a.itemId ?? ''}` : a.creatureId
    const keyB = b.kind ? `${b.kind}:${b.itemId ?? ''}` : b.creatureId
    return keyA.localeCompare(keyB)
  })
}

// Bottom-center fan of cards — reuses Unmelting's relic-fan CSS-variable
// trick (--hand-x/--hand-y/--hand-rot per card) rather than per-card inline
// transforms, so hover/hand-count changes stay pure CSS. Clicking a card
// selects it for placement; Game.ts decides what happens next.
export class CardHand {
  private readonly container: HTMLElement
  private cards: readonly HandCard[] = []
  // Whether each card is affordable now — necro cards dim/lock until their
  // summon cost is met. Defaults to always-affordable until Game supplies it.
  private affordFn: (card: HandCard) => boolean = () => true

  constructor(
    root: HTMLElement,
    private readonly onCardClick: (cardId: string) => void
  ) {
    this.container = document.createElement('div')
    this.container.className = 'hand-layer'
    root.appendChild(this.container)
    this.initHoverSpread()
  }

  /** Cursor-tracked fan spread — the relic dock's mechanism, applied to the
   * hand: the card under the pointer pins as the pivot (lifts, straightens,
   * comes to front) and its neighbours part aside so an overlapped hand can
   * be read card by card without clicking. The pivot comes from the fan's
   * own layout math (not the cursor's fraction of the container, which is
   * wider than the fan), and the push is capped so a deep hand's edge cards
   * don't fly off. Listeners live on the persistent container, so rebuilds
   * in render() need no re-attach. */
  private initHoverSpread(): void {
    const applyFocus = (ev: MouseEvent): void => {
      const els = Array.from(this.container.querySelectorAll<HTMLElement>('.hand-card'))
      const n = els.length
      if (n < 2) return
      const rect = this.container.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const step = Math.min(74, 620 / (n - 1))
      const spreadPx = step * (n - 1)
      const idx = Math.round((ev.clientX - centerX + spreadPx / 2) / step)
      const pivotIdx = Math.max(0, Math.min(n - 1, idx))
      els.forEach((el, i) => {
        const dist = i - pivotIdx
        const isPivot = dist === 0
        // Part the curtain around the cursor: strong push on immediate
        // neighbours, flattening out past ±3 cards.
        const push = Math.max(-78, Math.min(78, dist * 26))
        const splay = Math.max(-9, Math.min(9, dist * 3))
        // The pivot nearly straightens (counters its own fan rotation) so
        // the card reads upright while inspected.
        const baseRot = parseFloat(el.style.getPropertyValue('--hand-rot')) || 0
        el.style.setProperty('--hand-extra-x', `${push}px`)
        el.style.setProperty('--hand-extra-rot', isPivot ? `${-baseRot * 0.85}deg` : `${splay}deg`)
        el.style.setProperty('--hand-extra-y', isPivot ? '-18px' : '0px')
        el.style.setProperty('--hand-extra-scale', isPivot ? '0.06' : '0')
        // z-index can't ride a CSS calc once a pivot exists; restore on leave.
        el.style.zIndex = isPivot ? '100' : ''
      })
    }

    const clearFocus = (): void => {
      for (const el of this.container.querySelectorAll<HTMLElement>('.hand-card')) {
        el.style.removeProperty('--hand-extra-x')
        el.style.removeProperty('--hand-extra-rot')
        el.style.removeProperty('--hand-extra-y')
        el.style.removeProperty('--hand-extra-scale')
        el.style.zIndex = ''
      }
    }

    this.container.addEventListener('mousemove', applyFocus)
    this.container.addEventListener('mouseleave', clearFocus)
  }

  render(cards: readonly HandCard[], selectedId: string | null, affordFn?: (card: HandCard) => boolean): void {
    if (affordFn) this.affordFn = affordFn
    const previousIds = new Set(this.cards.map((c) => c.id))
    const sorted = sortForDisplay(cards)
    // Same cards, same order (a selection toggle, not an add/remove/merge) —
    // update classes on the EXISTING elements instead of rebuilding. A full
    // rebuild throws away every node and recreates fresh ones with no prior
    // frame to transition from, so the is-selected lift/glow (a CSS
    // transition) just snaps instead of animating — this keeps it alive.
    const sameSet =
      sorted.length === this.cards.length && sorted.every((c, i) => c.id === this.cards[i]?.id)
    if (sameSet) {
      this.cards = sorted
      for (const card of sorted) {
        const el = this.container.querySelector<HTMLElement>(`[data-card-id="${card.id}"]`)
        if (!el) continue
        el.classList.toggle('is-selected', card.id === selectedId)
        el.classList.toggle('is-unaffordable', !this.affordFn(card))
      }
      return
    }
    this.container.innerHTML = ''
    this.cards = sorted
    const total = sorted.length
    sorted.forEach((card, i) => {
      const el = document.createElement('button')
      el.type = 'button'
      el.dataset.cardId = card.id
      const creature = card.kind ? undefined : getCreature(card.creatureId)
      el.className = creature ? 'hand-card has-image' : 'hand-card'
      if (card.kind === 'item') el.classList.add('hand-card--item')
      if (card.kind === 'epic') el.classList.add('hand-card--epic')
      if (card.tier === 2) el.classList.add('hand-card--tier2')
      if (card.tier === 3) el.classList.add('hand-card--tier3')
      if (!previousIds.has(card.id)) el.classList.add('is-new')
      if (card.id === selectedId) el.classList.add('is-selected')
      if (!this.affordFn(card)) el.classList.add('is-unaffordable')
      const { x, y, rot } = fanTransform(i, total)
      el.style.setProperty('--hand-x', `${x}px`)
      el.style.setProperty('--hand-y', `${y}px`)
      el.style.setProperty('--hand-rot', `${rot}deg`)
      el.style.setProperty('--hand-i', `${i}`)
      // Necro cards preview the necromanced (after) form at the card's own
      // tier — the ally you'll get on placement. Items show a vial, epics a
      // sparkle facility star.
      const artHtml = creature
        ? `<img class="hand-card-image" src="${getAllyArt(creature.id, card.tier ?? 1)}" alt="" />`
        : card.kind === 'item'
          ? Icons.itemVial()
          : card.kind === 'epic'
            ? Icons.coinSparkle()
            : Icons.enemyToken()
      // Tier stars above the name — creature cards only (base = 1성, merged
      // climbs 2성/3성). Items/epics carry no rank.
      const tier = creature ? card.tier ?? 1 : 0
      const starsHtml =
        tier > 0
          ? `<div class="hand-card-stars" aria-label="${tier}성">${'★'.repeat(tier)}</div>`
          : ''
      // Summon-cost badge (sacral gauge) — necro cards only; items are free.
      const costHtml = creature ? `<div class="hand-card-cost">${summonCost(tier)}</div>` : ''
      el.innerHTML = `<div class="hand-card-art">${artHtml}</div>${costHtml}${starsHtml}<div class="hand-card-label">${card.label}</div>`
      el.addEventListener('click', () => this.onCardClick(card.id))
      this.container.appendChild(el)
    })
  }

  /** Marks the given hand cards as merge candidates — each pulses in its own
   * accent hue so it's clear which trio the 합성 button will fuse. */
  setMergeCandidates(ids: readonly string[]): void {
    this.container.querySelectorAll<HTMLElement>('.is-merge-candidate').forEach((el) => {
      el.classList.remove('is-merge-candidate')
      el.style.removeProperty('--merge-hue')
    })
    ids.forEach((id, i) => {
      const el = this.container.querySelector<HTMLElement>(`[data-card-id="${id}"]`)
      if (!el) return
      el.classList.add('is-merge-candidate')
      // Spread the trio across the spectrum so each reads as its own spark.
      el.style.setProperty('--merge-hue', `${(i * 118) % 360}`)
    })
  }

  /** Re-evaluates affordability and toggles the dim/lock class on existing
   * cards without rebuilding the fan — called when the gauge changes so a
   * card lights up the instant its summon cost is met. */
  refreshAffordability(affordFn: (card: HandCard) => boolean): void {
    this.affordFn = affordFn
    for (const card of this.cards) {
      const el = this.container.querySelector<HTMLElement>(`[data-card-id="${card.id}"]`)
      el?.classList.toggle('is-unaffordable', !affordFn(card))
    }
  }

  /** Viewport point the (nextCount)-th card will occupy, for aiming an incoming burst. */
  getNextSlotPoint(nextCount: number): { x: number; y: number } {
    const rect = this.container.getBoundingClientRect()
    const { x, y } = fanTransform(nextCount - 1, nextCount)
    return { x: rect.left + rect.width / 2 + x, y: rect.bottom + y }
  }

  /** Live viewport rect of a specific hand card — aims a travel effect FROM
   * it (e.g. flying onto the board when placed). Null if it's not currently
   * rendered. */
  getCardRect(cardId: string): DOMRect | null {
    return this.container.querySelector<HTMLElement>(`[data-card-id="${cardId}"]`)?.getBoundingClientRect() ?? null
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
