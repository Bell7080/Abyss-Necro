import { AbyssAmbience } from '@ui/AbyssAmbience'
import { BoardRenderer } from '@ui/BoardRenderer'
import { CardHand } from '@ui/CardHand'
import { CoinPanel } from '@ui/CoinPanel'
import { DefeatOverlay } from '@ui/DefeatOverlay'
import { IntroOverlay } from '@ui/IntroOverlay'
import { ItemInventory } from '@ui/ItemInventory'
import { ProceedButton } from '@ui/ProceedButton'
import { RelicInventory } from '@ui/RelicInventory'
import { RewardOverlay } from '@ui/RewardOverlay'
import { SkillBar } from '@ui/SkillBar'
import { WaveHud } from '@ui/WaveHud'
import { BlastManager } from '@ui/effects/BlastManager'
import { CurseMortar } from '@ui/effects/CurseMortar'
import { showDamageNumber } from '@ui/effects/FloatingDamage'
import { AbilitySystem } from '@systems/AbilitySystem'
import { CoinSystem } from '@systems/CoinSystem'
import { DefenderSystem } from '@systems/DefenderSystem'
import { HandSystem } from '@systems/HandSystem'
import { ItemSystem } from '@systems/ItemSystem'
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
import { drawRandomConsumable } from '@data/ConsumablePool'
import { getCreature } from '@data/CreatureDefinitions'
import { drawRelicOptions } from '@data/RelicPool'
import type { HandCard } from '@entities/Card'
import type { Relic } from '@entities/Relic'

const BASIC_ATTACK_DAMAGE = 2
const ULTIMATE_DAMAGE = 4
const RELIC_CHOICE_COUNT = 3

export class Game {
  private readonly handSystem = new HandSystem()
  private readonly relicSystem = new RelicSystem()
  private readonly itemSystem = new ItemSystem()
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
  private readonly items: ItemInventory
  private readonly coins: CoinPanel
  private readonly skillBar: SkillBar
  private readonly rewardOverlay: RewardOverlay
  private readonly proceedButton: ProceedButton
  private readonly defeatOverlay: DefeatOverlay
  private mergeInProgress = false
  // The intro overlay is pointer-transparent outside its button, so board/
  // orb clicks physically arrive before the run starts — gate them here.
  private runStarted = false

  constructor(root: HTMLElement) {
    const shell = document.createElement('div')
    shell.className = 'abyss-shell'
    root.appendChild(shell)

    const boardMount = document.createElement('div')
    boardMount.className = 'board-mount'
    shell.appendChild(boardMount)

    const sidePanels = document.createElement('div')
    sidePanels.className = 'side-panels'
    shell.appendChild(sidePanels)

    new WaveHud(shell, this.waveSystem)
    this.coins = new CoinPanel(shell)

    this.relics = new RelicInventory(sidePanels)
    this.items = new ItemInventory(sidePanels)
    this.hand = new CardHand(shell, (cardId) => {
      this.handSystem.toggleSelect(cardId)
    })
    this.board = new BoardRenderer(boardMount, this.waveSystem, this.defenderSystem, (cellIndex) =>
      this.handleCellClick(cellIndex)
    )
    this.skillBar = new SkillBar(shell, this.abilitySystem, {
      onUltimateClick: () => this.castUltimate(),
    })
    this.rewardOverlay = new RewardOverlay({
      onChoose: (relic, cardEl) => this.resolveRelicChoice(relic, cardEl),
    })
    this.proceedButton = new ProceedButton(shell, () => this.waveSystem.resumeFromCheckpoint())
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
    this.handSystem.onChange(() => {
      this.hand.render(this.handSystem.getCards(), this.handSystem.getSelectedId())
      this.board.setPlacementTargeting(!!this.handSystem.getSelectedId())
    })
    this.relicSystem.onChange((relics) => this.relics.render(relics))
    this.itemSystem.onChange((items) => this.items.render(items))
    this.coinSystem.onChange((coins) => this.coins.render(coins))
    this.abilitySystem.onChange(() => this.skillBar.render())

    this.hand.render(this.handSystem.getCards(), this.handSystem.getSelectedId())
    this.relics.render(this.relicSystem.getRelics())
    this.items.render(this.itemSystem.getItems())
    this.coins.render(this.coinSystem.getCoins())
    this.skillBar.render()
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
    if (!this.defenderSystem.place(cellIndex, card.label, card.creatureId)) return
    this.handSystem.removeCard(card.id)
  }

  private castBasicAttack(cellIndex: number): void {
    const originRect = this.board.getPlayerRect()
    const targetRect = this.board.getCellRect(cellIndex)
    if (!originRect || !targetRect) return

    const origin = centerOf(originRect)
    const target = centerOf(targetRect)

    CurseMortar.fire(origin.x, origin.y, target.x, target.y, {
      onImpact: () => {
        const result = this.waveSystem.applyDamage(cellIndex, BASIC_ATTACK_DAMAGE)
        if (result) showDamageNumber(target.x, target.y, result.amount)
      },
    })
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
          const result = this.waveSystem.applyDamage(cellIndex, ULTIMATE_DAMAGE)
          if (result) showDamageNumber(target.x, target.y, result.amount)
        },
      })
    }
  }

  private handleEncounter(result: EncounterResult): void {
    const rect = this.board.getCellRect(result.cellIndex)
    this.board.playDefeatFx(result.cellIndex)
    if (result.viaBossRoom) this.board.pulseBossRoom()

    if (result.dropCard && rect) {
      const nextCount = this.handSystem.getCards().length + 1
      const target = this.hand.getNextSlotPoint(nextCount)
      const creature = getCreature(result.creatureId)

      this.blast.travelDrop(rect, target, () => {
        this.handSystem.addCard({
          id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          label: creature?.label ?? '심연의 것',
          creatureId: result.creatureId,
        })
        this.tryMergeTriple()
      })
    }

    if (result.dropItem && rect) {
      const target = this.items.getDropPoint()
      this.blast.travelDrop(rect, target, () => this.itemSystem.addItem(drawRandomConsumable()))
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

  /** Three identical base cards in hand jelly-merge into one tier-2 card
   * (placeholder rank until the real evolution roster lands). The fx runs
   * first; the model swap happens on its final beat, and we re-check in
   * case another triple completed while the animation played. */
  private tryMergeTriple(): void {
    if (this.mergeInProgress) return
    const triple = this.handSystem.findTriple()
    if (!triple) return

    this.mergeInProgress = true
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
        this.tryMergeTriple()
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

  /** Every 5 forced waves the game pauses for a lull; every 3rd such
   * checkpoint offers a relic instead of just a "proceed" prompt. */
  private handleCheckpoint(info: CheckpointInfo): void {
    if (info.isRelicCheckpoint) {
      this.rewardOverlay.show(drawRelicOptions(RELIC_CHOICE_COUNT))
    } else {
      this.proceedButton.show()
    }
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
