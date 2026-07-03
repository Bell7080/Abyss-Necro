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

const PRICE_NECRO = 2
const PRICE_ITEM = 2
const PRICE_EPIC = 6

// Checkpoint shop — unfolds sparkling from the screen center during the
// lull and offers three random cards (minions / usables / a rare facility).
// Display + offer rolling only; payment and hand delivery live in Game.
export class ShopOverlay {
  private readonly overlay: HTMLElement
  private readonly cardsEl: HTMLElement
  private offers: ShopOffer[] = []

  constructor(private readonly handlers: ShopHandlers) {
    this.overlay = document.createElement('div')
    this.overlay.className = 'shop-overlay'
    this.overlay.innerHTML = `
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

  show(): void {
    this.offers = [0, 1, 2].map((slot) => this.rollOffer(slot))
    this.renderOffers()
    this.overlay.classList.add('is-visible')
  }

  hide(): void {
    this.overlay.classList.remove('is-visible')
  }

  private rollOffer(slot: number): ShopOffer {
    const roll = Math.random()
    if (roll < 0.2) {
      return { slot, price: PRICE_EPIC, kind: 'epic', epic: EPIC_CARDS[Math.floor(Math.random() * EPIC_CARDS.length)] }
    }
    if (roll < 0.55) {
      return { slot, price: PRICE_ITEM, kind: 'item', item: ITEM_CARDS[Math.floor(Math.random() * ITEM_CARDS.length)] }
    }
    return {
      slot,
      price: PRICE_NECRO,
      kind: 'necro',
      creature: CREATURES[Math.floor(Math.random() * CREATURES.length)],
    }
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
