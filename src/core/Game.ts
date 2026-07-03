import { AbyssAmbience } from '@ui/AbyssAmbience'
import { BoardRenderer } from '@ui/BoardRenderer'
import { CardHand } from '@ui/CardHand'
import { CardInspector } from '@ui/CardInspector'
import { CoinPanel } from '@ui/CoinPanel'
import { DefeatOverlay } from '@ui/DefeatOverlay'
import { IntroOverlay } from '@ui/IntroOverlay'
import { MergeButton } from '@ui/MergeButton'
import { RelicInventory } from '@ui/RelicInventory'
import { RewardOverlay } from '@ui/RewardOverlay'
import { ShopOverlay, type ShopOffer } from '@ui/ShopOverlay'
import { SkillBar } from '@ui/SkillBar'
import { WaveHud } from '@ui/WaveHud'
import { BlastManager } from '@ui/effects/BlastManager'
import { CurseMortar } from '@ui/effects/CurseMortar'
import { showDamageNumber } from '@ui/effects/FloatingDamage'
import { AbilitySystem } from '@systems/AbilitySystem'
import { CoinSystem } from '@systems/CoinSystem'
import { DefenderSystem } from '@systems/DefenderSystem'
import { HandSystem } from '@systems/HandSystem'
import { PlayerSystem } from '@systems/PlayerSystem'
import { RelicSystem } from '@systems/RelicSystem'
import {
  WaveSystem,
  type CheckpointInfo,
  type ClashInfo,
  type EncounterResult,
  type PlayerHitInfo,
} from '@systems/WaveSystem'
import { TickManager } from '@core/TickManager'
import { getCreature } from '@data/CreatureDefinitions'
import { getEpicCard, randomEpicCard } from '@data/EpicCardDefinitions'
import { getItemCard, randomItemCard } from '@data/ItemCardDefinitions'
import { drawRelicOptions } from '@data/RelicPool'
import type { HandCard } from '@entities/Card'
import type { Relic } from '@entities/Relic'

const BASIC_ATTACK_DAMAGE = 2
const ULTIMATE_DAMAGE = 4
const RELIC_CHOICE_COUNT = 3
// While a hand card is held (selected for placement) the whole game clock
// crawls, giving the player a slow-motion beat to read the board.
const AIM_TIME_SCALE = 0.3

export class Game {
  private readonly handSystem = new HandSystem()
  private readonly relicSystem = new RelicSystem()
  private readonly coinSystem = new CoinSystem()
  private readonly playerSystem = new PlayerSystem()
  private readonly defenderSystem = new DefenderSystem()
  private readonly waveSystem = new WaveSystem(this.defenderSystem)
  private readonly abilitySystem = new AbilitySystem()
  private readonly tickManager = new TickManager()
  private readonly blast = new BlastManager()
  private readonly board: BoardRenderer
  private readonly hand: CardHand
  private readonly relics: RelicInventory
  private readonly coins: CoinPanel
  private readonly skillBar: SkillBar
  private readonly rewardOverlay: RewardOverlay
  private readonly shopOverlay: ShopOverlay
  private readonly defeatOverlay: DefeatOverlay
  // Epic permanent upgrades to the player's own casts.
  private basicDamageBonus = 0
  private ultimateDamageBonus = 0
  private readonly inspector: CardInspector
  private readonly mergeButton: MergeButton
  private readonly shellEl: HTMLElement
  private mergeInProgress = false
  private aiming = false
  // The intro overlay is pointer-transparent outside its button, so board/
  // orb clicks physically arrive before the run starts — gate them here.
  private runStarted = false

  constructor(root: HTMLElement) {
    const shell = document.createElement('div')
    shell.className = 'abyss-shell'
    root.appendChild(shell)
    this.shellEl = shell

    // Backdrop dim for aim mode — sits under the board (DOM order), so the
    // raised board pops while everything else sinks into darkness.
    const aimDim = document.createElement('div')
    aimDim.className = 'aim-dim'
    shell.appendChild(aimDim)

    const boardMount = document.createElement('div')
    boardMount.className = 'board-mount'
    shell.appendChild(boardMount)

    new WaveHud(shell, this.waveSystem)
    this.coins = new CoinPanel(shell)

    this.inspector = new CardInspector(shell)
    // Relics keep a fixed dock at the bottom-right, always visible —
    // independent of the inspector, which only exists while aiming.
    const relicDock = document.createElement('div')
    relicDock.className = 'relic-dock'
    shell.appendChild(relicDock)
    this.relics = new RelicInventory(relicDock)
    this.hand = new CardHand(shell, (cardId) => {
      this.handSystem.toggleSelect(cardId)
    })
    this.mergeButton = new MergeButton(shell, () => this.performMerge())
    this.board = new BoardRenderer(boardMount, this.waveSystem, this.defenderSystem, (cellIndex) =>
      this.handleCellClick(cellIndex)
    )
    this.skillBar = new SkillBar(shell, this.abilitySystem, {
      onUltimateClick: () => this.castUltimate(),
    })
    this.rewardOverlay = new RewardOverlay({
      onChoose: (relic, cardEl) => this.resolveRelicChoice(relic, cardEl),
    })
    this.shopOverlay = new ShopOverlay({
      onBuy: (offer, cardEl) => this.buyShopOffer(offer, cardEl),
      onLeave: () => this.waveSystem.resumeFromCheckpoint(),
    })
    new AbyssAmbience(shell)
    this.defeatOverlay = new DefeatOverlay(shell)
    new IntroOverlay(shell, () => this.startRun())

    this.waveSystem.onChange(() => this.board.syncCells())
    this.waveSystem.onEncounter((result) => this.handleEncounter(result))
    this.waveSystem.onCheckpoint((info) => this.handleCheckpoint(info))
    this.waveSystem.onClash((info) => this.handleClash(info))
    this.waveSystem.onPlayerHit((info) => this.handlePlayerHit(info))
    this.playerSystem.onChange(() =>
      this.board.setPlayerHp(this.playerSystem.getHp(), this.playerSystem.getMaxHp())
    )
    this.playerSystem.onDefeat(() => this.handleDefeat())
    this.defenderSystem.onChange(() => this.board.syncCells())
    this.handSystem.onChange(() => this.handleHandChange())
    this.relicSystem.onChange((relics) => this.relics.render(relics))
    this.coinSystem.onChange((coins) => this.coins.render(coins))
    this.abilitySystem.onChange(() => this.skillBar.render())

    this.hand.render(this.handSystem.getCards(), this.handSystem.getSelectedId())
    this.relics.render(this.relicSystem.getRelics())
    this.coins.render(this.coinSystem.getCoins())
    this.skillBar.render()
  }

  /** Selection drives everything aim-related: the fan re-render, placement
   * targeting, the inspector panel, the backdrop dim, and slow motion. */
  private handleHandChange(): void {
    const selected = this.handSystem.getSelectedCard()
    this.hand.render(this.handSystem.getCards(), this.handSystem.getSelectedId())
    this.board.setPlacementTargeting(!!selected)
    this.mergeButton.setVisible(!this.mergeInProgress && !!this.handSystem.findTriple())

    if (selected) this.inspector.show(selected)
    else this.inspector.hide()
    this.setAiming(!!selected)
  }

  /** Aim mode: darken everything but the board and crawl the game clock —
   * a held breath while choosing where the card goes. */
  private setAiming(active: boolean): void {
    if (this.aiming === active) return
    this.aiming = active
    this.shellEl.classList.toggle('is-aiming', active)
    const scale = active ? AIM_TIME_SCALE : 1
    this.tickManager.setRate(scale)
    this.waveSystem.setTimeScale(scale)
  }

  boot(): void {
    this.board.render()
  }

  /** Fired once, when the player dismisses the intro veil — nothing spawns
   * or moves before this. */
  private startRun(): void {
    this.runStarted = true
    this.waveSystem.start(this.tickManager)
    this.abilitySystem.start(this.tickManager)
    this.tickManager.start()
  }

  private handleCellClick(cellIndex: number): void {
    if (!this.runStarted) return
    const selectedCard = this.handSystem.getSelectedCard()
    if (selectedCard) {
      this.tryPlaceCard(cellIndex, selectedCard)
      return
    }

    // Basic attack fires unconditionally on click — no arming step. Only
    // the ultimate needs its own skill-orb click (see onUltimateClick).
    // Neither fires during a checkpoint lull — leftover enemies just stand
    // there unharmed until the player proceeds.
    if (this.waveSystem.isPaused()) return
    if (!this.abilitySystem.tryCastBasic()) return
    this.castBasicAttack(cellIndex)
  }

  private tryPlaceCard(cellIndex: number, card: HandCard): void {
    if (card.kind === 'item') {
      this.useItemCard(cellIndex, card)
      return
    }
    if (card.kind === 'epic') {
      this.useEpicCard(cellIndex, card)
      return
    }
    if (!this.defenderSystem.place(cellIndex, card.label, card.creatureId)) return
    this.handSystem.removeCard(card.id)
  }

  /** Epic facility cards: 함정별 needs a grid cell; the global ones apply
   * their permanent buff wherever the click lands. */
  private useEpicCard(cellIndex: number, card: HandCard): void {
    const def = getEpicCard(card.itemId ?? '')
    if (!def) return

    if (def.id === 'trap-star') {
      if (!this.waveSystem.addCellTrap(cellIndex)) return
    } else if (def.id === 'power-star') {
      this.defenderSystem.addAttackBonus(1)
    } else if (def.id === 'vitality-star') {
      this.playerSystem.increaseMaxHp(2)
    } else if (def.id === 'sharpen-star') {
      this.basicDamageBonus += 1
    } else if (def.id === 'overload-star') {
      this.ultimateDamageBonus += 2
    }

    const rect = this.board.getCellRect(cellIndex)
    if (rect) this.blast.clashBurst(rect)
    this.handSystem.removeCard(card.id)
  }

  /** Item cards resolve on the aimed cell and are consumed. A targeted card
   * that finds nothing valid there (healing an empty cell) stays in hand. */
  private useItemCard(cellIndex: number, card: HandCard): void {
    const def = getItemCard(card.itemId ?? '')
    if (!def) return

    if (def.id === 'abyss-pulse') {
      const results = this.waveSystem.damageAllEnemies(1)
      for (const hit of results) {
        const rect = this.board.getCellRect(hit.cellIndex)
        if (rect) this.showHitNumber(hit.cellIndex, hit.amount, centerOf(rect))
      }
      this.handSystem.removeCard(card.id)
      return
    }

    if (def.id === 'healing-bubble') {
      if (!this.defenderSystem.healCell(cellIndex, 3)) return
      const rect = this.board.getCellRect(cellIndex)
      if (rect) this.blast.clashBurst(rect)
      this.handSystem.removeCard(card.id)
    }
  }

  private castBasicAttack(cellIndex: number): void {
    const originRect = this.board.getPlayerRect()
    const targetRect = this.board.getCellRect(cellIndex)
    if (!originRect || !targetRect) return

    const origin = centerOf(originRect)
    const target = centerOf(targetRect)

    CurseMortar.fire(origin.x, origin.y, target.x, target.y, {
      onImpact: () => {
        const result = this.waveSystem.applyDamage(cellIndex, BASIC_ATTACK_DAMAGE + this.basicDamageBonus)
        if (result) this.showHitNumber(result.cellIndex, result.amount, target)
      },
    })
  }

  /** Damage number over the cell the hit actually landed in — with the
   * grace judgement that can be the enemy's new cell, not the clicked one. */
  private showHitNumber(hitCellIndex: number, amount: number, fallback: { x: number; y: number }): void {
    const rect = this.board.getCellRect(hitCellIndex)
    const point = rect ? centerOf(rect) : fallback
    showDamageNumber(point.x, point.y, amount)
  }

  private castUltimate(): void {
    if (!this.runStarted) return
    if (this.waveSystem.isPaused()) return
    if (!this.abilitySystem.tryCastUltimate()) return
    const originRect = this.board.getPlayerRect()
    if (!originRect) return
    const origin = centerOf(originRect)

    for (const cellIndex of this.waveSystem.getAliveCellIndices()) {
      const targetRect = this.board.getCellRect(cellIndex)
      if (!targetRect) continue
      const target = centerOf(targetRect)

      CurseMortar.fire(origin.x, origin.y, target.x, target.y, {
        delay: Math.random() * 140,
        onImpact: () => {
          const result = this.waveSystem.applyDamage(cellIndex, ULTIMATE_DAMAGE + this.ultimateDamageBonus)
          if (result) this.showHitNumber(result.cellIndex, result.amount, target)
        },
      })
    }
  }

  private handleEncounter(result: EncounterResult): void {
    const rect = this.board.getCellRect(result.cellIndex)
    this.board.playDefeatFx(result.cellIndex)
    if (result.viaBossRoom) this.board.pulseBossRoom()

    // Every kill hands over exactly one card — necro (places a defender)
    // or item (one-shot usable), 50/50 with a wave-1 necro pity.
    if (rect) {
      const nextCount = this.handSystem.getCards().length + 1
      const target = this.hand.getNextSlotPoint(nextCount)
      const id = `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

      if (result.drop === 'necro') {
        const creature = getCreature(result.creatureId)
        this.blast.travelDrop(rect, target, () => {
          this.handSystem.addCard({
            id,
            label: creature?.label ?? '심연의 것',
            creatureId: result.creatureId,
          })
        })
      } else if (result.drop === 'item') {
        const item = randomItemCard()
        this.blast.travelDrop(rect, target, () => {
          this.handSystem.addCard({
            id,
            label: item.label,
            creatureId: '',
            kind: 'item',
            itemId: item.id,
          })
        })
      } else {
        const epic = randomEpicCard()
        this.blast.travelDrop(rect, target, () => {
          this.handSystem.addCard({
            id,
            label: epic.label,
            creatureId: '',
            kind: 'epic',
            itemId: epic.id,
          })
        })
      }
    }

    // Every kill drops a coin: it lands on the ground in a short lobbed arc,
    // then blasts from that exact spot into the coin panel as a bubble
    // travel-in, same beat the counter bumps.
    if (result.dropCoin && rect) {
      const target = this.coins.getDropPoint()
      this.blast.coinDrop(rect, target, () => {
        this.coinSystem.addCoins(1)
        this.coins.pulse()
      })
    }
  }

  /** Player pressed the sparkling 합성 button: three identical base cards
   * jelly-merge into one tier-2 card (placeholder rank until the real
   * evolution roster lands). The fx runs first; the model swap happens on
   * its final beat, and the button re-lights if another triple remains. */
  private performMerge(): void {
    if (this.mergeInProgress) return
    const triple = this.handSystem.findTriple()
    if (!triple) return

    this.mergeInProgress = true
    this.mergeButton.setVisible(false)
    const base = triple[0]
    this.hand.playMergeFx(
      triple.map((card) => card.id),
      () => {
        this.handSystem.mergeTriple(
          triple.map((card) => card.id),
          {
            id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            label: base.label,
            creatureId: base.creatureId,
            tier: 2,
          }
        )
        this.mergeInProgress = false
        this.mergeButton.setVisible(!!this.handSystem.findTriple())
      }
    )
  }

  /** A defender and enemy sharing a cell trade a hit — lunge the two tokens
   * at each other and pop a shallow bubble burst at the collision point. */
  private handleClash(info: ClashInfo): void {
    const rect = this.board.getCellRect(info.cellIndex)
    if (!rect) return

    this.board.playClashFx(info.cellIndex)
    this.blast.clashBurst(rect)
  }

  /** An enemy in the player room found no defender and struck the
   * necromancer directly — engage pulse + damage number on the player card,
   * actual HP loss in PlayerSystem (which raises onDefeat at zero). */
  private handlePlayerHit(info: PlayerHitInfo): void {
    this.playerSystem.damage(info.damage)
    this.board.pulseBossRoom()
    this.board.flashPlayerHit()
    const rect = this.board.getPlayerRect()
    if (rect) {
      const center = centerOf(rect)
      showDamageNumber(center.x, center.y, info.damage)
    }
  }

  /** The necromancer fell: freeze the whole world clock and the pending
   * wave push, then close the abyss over the board. Retry = page reload. */
  private handleDefeat(): void {
    this.tickManager.stop()
    this.waveSystem.halt()
    this.defeatOverlay.show(this.waveSystem.getWaveNumber())
  }

  /** Each 3-wave round ends in a lull: the sparkling center shop unfolds,
   * except every 3rd checkpoint, which offers a relic pick instead. */
  private handleCheckpoint(info: CheckpointInfo): void {
    if (info.isRelicCheckpoint) {
      this.rewardOverlay.show(drawRelicOptions(RELIC_CHOICE_COUNT))
    } else {
      this.shopOverlay.show()
    }
  }

  /** Shop purchase: pay 별빛, then the bought card bubbles into the hand. */
  private buyShopOffer(offer: ShopOffer, cardEl: HTMLElement): boolean {
    if (!this.coinSystem.spend(offer.price)) return false

    const nextCount = this.handSystem.getCards().length + 1
    const target = this.hand.getNextSlotPoint(nextCount)
    const id = `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

    this.blast.travelDrop(cardEl.getBoundingClientRect(), target, () => {
      if (offer.kind === 'necro' && offer.creature) {
        this.handSystem.addCard({ id, label: offer.creature.label, creatureId: offer.creature.id })
      } else if (offer.kind === 'item' && offer.item) {
        this.handSystem.addCard({ id, label: offer.item.label, creatureId: '', kind: 'item', itemId: offer.item.id })
      } else if (offer.kind === 'epic' && offer.epic) {
        this.handSystem.addCard({ id, label: offer.epic.label, creatureId: '', kind: 'epic', itemId: offer.epic.id })
      }
    })
    return true
  }

  private resolveRelicChoice(relic: Relic, cardEl: HTMLElement): void {
    const target = this.relics.getDropPoint()

    this.rewardOverlay.hide()
    this.waveSystem.resumeFromCheckpoint()

    this.blast.travelDrop(cardEl.getBoundingClientRect(), target, () => this.relicSystem.addRelic(relic))
  }
}

function centerOf(rect: DOMRect): { x: number; y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}
