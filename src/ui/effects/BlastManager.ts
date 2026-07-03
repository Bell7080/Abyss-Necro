import { BubbleBurst } from '@ui/effects/BubbleBurst'
import { CoinDrop } from '@ui/effects/CoinDrop'

// A beat of rest once a dropped coin actually lands, so it visibly sits on
// the ground before blasting off toward the panel instead of chaining
// instantly into the travel burst.
const COIN_LAND_PAUSE_MS = 260

export interface Point {
  x: number
  y: number
}

/**
 * BlastManager — the single place that turns "something dropped/landed" into
 * a BubbleBurst/CoinDrop call. Game.ts hands it a source rect and a target
 * point and gets an onArrive callback timed to when the bubbles visually
 * land; it never touches BubbleBurst/CoinDrop directly. Keeps state changes
 * (addCard/addItem/addCoins/addRelic) in the caller's onArrive — this class
 * only choreographs the visual travel.
 */
export class BlastManager {
  /** Card/item/relic pickups: a bubble swarm arcs from the drop point to the
   * destination panel/hand slot. */
  travelDrop(originRect: DOMRect, target: Point, onArrive: () => void): void {
    const origin = centerOf(originRect)
    BubbleBurst.travelTo(origin.x, origin.y, target.x, target.y, { onArrive })
  }

  /** Coin drop: a short lobbed arc onto the ground, a brief pause, then the
   * same bubble travel into the coin panel. */
  coinDrop(originRect: DOMRect, target: Point, onArrive: () => void): void {
    const origin = centerOf(originRect)
    CoinDrop.fire(origin.x, origin.y, {
      onLand: () => {
        window.setTimeout(() => {
          BubbleBurst.travelTo(origin.x, origin.y, target.x, target.y, { onArrive })
        }, COIN_LAND_PAUSE_MS)
      },
    })
  }

  /** A stationary pop at a cell — used for a clash landing, not a delivery. */
  clashBurst(cellRect: DOMRect): void {
    const center = centerOf(cellRect)
    BubbleBurst.burstAt(center.x, center.y, { count: 6, size: [6, 12] })
  }
}

function centerOf(rect: DOMRect): Point {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}
