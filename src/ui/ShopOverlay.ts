import { CREATURES, type CreatureDefinition } from '@data/CreatureDefinitions'
import { EPIC_CARDS, type EpicCardDefinition } from '@data/EpicCardDefinitions'
import { ITEM_CARDS, type ItemCardDefinition } from '@data/ItemCardDefinitions'
import { Icons } from '@ui/Icons'

// One purchasable slot in the checkpoint shop.
export interface ShopOffer {
  slot: number
  price: number
  kind: 'necro' | 'item' | 'epic'
  creature?: CreatureDefinition
  item?: ItemCardDefinition
  epic?: EpicCardDefinition
}

export interface ShopHandlers {
  /** Attempt a purchase; return true if paid (slot then marks sold). */
  onBuy: (offer: ShopOffer, cardEl: HTMLElement) => boolean
  /** EXIT — the lull ends and the held-back wave arrives. */
  onLeave: () => void
}

const PRICE_ITEM = 2
const PRICE_EPIC = 6
// A minion's price scales directly with how strong it is.
const PRICE_PER_CREATURE_LEVEL = 2
// The final boss (상어) is never sold as a minion.
const SHOP_EXCLUDED = new Set(['shark'])
const MAX_CREATURE_LEVEL = Math.max(...CREATURES.map((c) => c.level))
// Two rows of four.
const SLOT_COUNT = 8

// Checkpoint shop — dark water fog rolls in from both edges to swallow the
// field, then the panel unfolds sparkling from the screen center and offers
// eight random cards (4×2): mostly facility epics/usables, plus minions drawn
// only from creatures the player has actually necro'd at least once. Display +
// offer rolling only; payment and hand delivery live in Game.
export class ShopOverlay {
  private readonly overlay: HTMLElement
  private readonly cardsEl: HTMLElement
  private offers: ShopOffer[] = []
  // How deep the run is (the wave just cleared) — scales offer quality.
  private depth = 0
  // Creatures the player has ever held as a card — the only minions stocked.
  private captured: ReadonlySet<string> = new Set()

  constructor(private readonly handlers: ShopHandlers) {
    this.overlay = document.createElement('div')
    this.overlay.className = 'shop-overlay'
    this.overlay.innerHTML = `
      <div class="shop-fog shop-fog--left"><div class="shop-fog-inner"></div></div>
      <div class="shop-fog shop-fog--right"><div class="shop-fog-inner"></div></div>
      <div class="shop-panel">
        <div class="shop-title">심연 상점</div>
        <div class="shop-cards"></div>
        <button type="button" class="shop-leave-button">계속 나아가기</button>
      </div>`
    this.cardsEl = this.overlay.querySelector('.shop-cards') as HTMLElement
    this.overlay
      .querySelector('.shop-leave-button')!
      .addEventListener('click', () => {
        this.hide()
        this.handlers.onLeave()
      })
    document.body.appendChild(this.overlay)
  }

  /** `depth` is the wave just cleared — deeper shops roll stronger minions and
   * more epics. `captured` limits the minion pool to creatures the player has
   * actually necro'd at least once this run. */
  show(depth = 0, captured: ReadonlySet<string> = new Set()): void {
    this.depth = depth
    this.captured = captured
    this.offers = Array.from({ length: SLOT_COUNT }, (_, slot) => this.rollOffer(slot))
    this.renderOffers()
    this.overlay.classList.add('is-visible')
  }

  hide(): void {
    this.overlay.classList.remove('is-visible')
  }

  /** Highest creature level the shop stocks at the current depth — climbs with
   * the run so the pool of minions gradually upgrades. */
  private levelCap(): number {
    return Math.max(2, Math.min(MAX_CREATURE_LEVEL, 2 + Math.floor(this.depth / 3)))
  }

  private rollOffer(slot: number): ShopOffer {
    // The shop leads with facility upgrades: mostly epics, a band of usable
    // items, and a minority of minions (deeper runs tilt epic even harder).
    const epicChance = Math.min(0.6, 0.45 + this.depth * 0.005)
    const itemChance = 0.2
    const roll = Math.random()
    if (roll >= epicChance + itemChance) {
      const creature = this.rollCreature()
      if (creature) {
        return {
          slot,
          // Price scales 1:1 with strength — a level-N minion costs ✦ N×2.
          price: creature.level * PRICE_PER_CREATURE_LEVEL,
          kind: 'necro',
          creature,
        }
      }
      // Nothing necro'd yet at this depth — the slot falls back to an epic.
    }
    if (roll >= epicChance && roll < epicChance + itemChance) {
      return { slot, price: PRICE_ITEM, kind: 'item', item: ITEM_CARDS[Math.floor(Math.random() * ITEM_CARDS.length)] }
    }
    return { slot, price: PRICE_EPIC, kind: 'epic', epic: EPIC_CARDS[Math.floor(Math.random() * EPIC_CARDS.length)] }
  }

  /** A minion from the pool eligible at this depth — only creatures the player
   * has already necro'd once — weighted toward the deepest available levels so
   * late shops favour the strong ones while still sometimes offering a cheap
   * low body to complete a trio. Null when nothing is eligible yet. */
  private rollCreature(): CreatureDefinition | null {
    const cap = this.levelCap()
    const pool = CREATURES.filter(
      (c) => c.level <= cap && !SHOP_EXCLUDED.has(c.id) && this.captured.has(c.id)
    )
    if (pool.length === 0) return null
    // Weight = level, so higher-level creatures are likelier (but not exclusive).
    const totalWeight = pool.reduce((sum, c) => sum + c.level, 0)
    let pick = Math.random() * totalWeight
    for (const c of pool) {
      pick -= c.level
      if (pick <= 0) return c
    }
    return pool[pool.length - 1]
  }

  private renderOffers(): void {
    this.cardsEl.innerHTML = ''
    for (const offer of this.offers) {
      const card = document.createElement('button')
      card.type = 'button'
      card.className = `shop-card shop-card--${offer.kind}`

      const label = offer.creature?.label ?? offer.item?.label ?? offer.epic?.label ?? ''
      const artHtml = offer.creature
        ? `<img class="shop-card-image" src="${offer.creature.allyArt}" alt="" />`
        : `<span class="shop-card-glyph">${offer.kind === 'epic' ? Icons.coinSparkle() : Icons.itemVial()}</span>`

      card.innerHTML = `
        <div class="shop-card-art">${artHtml}</div>
        <div class="shop-card-label">${label}</div>
        <div class="shop-card-price">${Icons.coinSparkle()}<span>${offer.price}</span></div>`

      card.addEventListener('click', () => {
        if (card.classList.contains('is-sold')) return
        if (!this.handlers.onBuy(offer, card)) {
          // Can't afford — small refusal shake.
          card.classList.remove('is-denied')
          void card.offsetWidth
          card.classList.add('is-denied')
          return
        }
        card.classList.add('is-sold')
      })
      this.cardsEl.appendChild(card)
    }
  }
}
