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

  /** A fallen ally's essence rises as a gold star and drifts to the
   * graveyard (or, when reclaimed, from the graveyard to the hand). */
  starFly(from: Point, target: Point, onArrive: () => void): void {
    BubbleBurst.travelTo(from.x, from.y, target.x, target.y, {
      count: 7,
      size: [7, 15],
      duration: 720,
      colors: ['#ffe6a2', '#ffd27a', '#fff4d8', '#e8b85a'],
      onArrive,
    })
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

  /** Passive fx at a cell: an electric cyan spark (jelly-amp), a soft green
   * heal bloom (rabbit-heal), a warm amber shield pop (crab-guard), a wide
   * white splash (cleave — hitting several), or a crimson chomp (devour). */
  passiveBurst(cellRect: DOMRect, kind: 'spark' | 'heal' | 'shield' | 'cleave' | 'devour'): void {
    const center = centerOf(cellRect)
    if (kind === 'spark') {
      BubbleBurst.burstAt(center.x, center.y, {
        count: 7,
        size: [5, 10],
        spread: 34,
        colors: ['#7fe8ff', '#bff4ff', '#ffffff', '#4aa8e0'],
      })
    } else if (kind === 'heal') {
      BubbleBurst.burstAt(center.x, center.y, {
        count: 8,
        size: [6, 13],
        spread: 30,
        colors: ['#3fae74', '#67c498', '#bff5d8', '#e8fff2'],
      })
    } else if (kind === 'cleave') {
      // A wide, thin splash — reads as one strike sweeping several targets.
      BubbleBurst.burstAt(center.x, center.y, {
        count: 12,
        size: [5, 11],
        spread: 68,
        colors: ['#eaf3ff', '#c7dcff', '#ffffff', '#9db9e8'],
      })
    } else if (kind === 'devour') {
      // A tight crimson chomp — the "eat" beat before the attack-up popup.
      BubbleBurst.burstAt(center.x, center.y, {
        count: 10,
        size: [7, 15],
        spread: 26,
        colors: ['#ff5a6e', '#c8324a', '#ffb0a0', '#7a0f1e'],
      })
    } else {
      BubbleBurst.burstAt(center.x, center.y, {
        count: 8,
        size: [6, 13],
        spread: 32,
        colors: ['#e0782a', '#ffb057', '#ffd9a0', '#fff1dc'],
      })
    }
  }
}

function centerOf(rect: DOMRect): Point {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}
