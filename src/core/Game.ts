import { AbyssAmbience } from '@ui/AbyssAmbience'
import { BoardRenderer } from '@ui/BoardRenderer'
import { CardHand } from '@ui/CardHand'
import { CardInspector, type InspectorData } from '@ui/CardInspector'
import { CellMergeButton } from '@ui/CellMergeButton'
import { CoinPanel } from '@ui/CoinPanel'
import { DefeatOverlay } from '@ui/DefeatOverlay'
import { GraveyardPanel } from '@ui/GraveyardPanel'
import { IntroOverlay } from '@ui/IntroOverlay'
import { MergeButton } from '@ui/MergeButton'
import { RelicInventory } from '@ui/RelicInventory'
import { RewardOverlay } from '@ui/RewardOverlay'
import { ShopOverlay, type ShopOffer } from '@ui/ShopOverlay'
import { SkillHive } from '@ui/SkillHive'
import { WaveHud } from '@ui/WaveHud'
import { BlastManager } from '@ui/effects/BlastManager'
import { CurseMortar } from '@ui/effects/CurseMortar'
import { showDamageNumber } from '@ui/effects/FloatingDamage'
import { AbilitySystem, type AbilityId } from '@systems/AbilitySystem'
import { CoinSystem } from '@systems/CoinSystem'
import { CorpseSystem, type Corpse } from '@systems/CorpseSystem'
import { DefenderSystem, type AllyDeath } from '@systems/DefenderSystem'
import { GraveyardSystem } from '@systems/GraveyardSystem'
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
import type { PassiveEvent } from '@systems/PassiveEvent'
import { TickManager } from '@core/TickManager'
import { BOSS_CELL_INDEX } from '@systems/BoardConstants'
import playerArtUrl from '@/assets/sprites/player_001.webp'
import { getCreature } from '@data/CreatureDefinitions'
import { getEpicCard } from '@data/EpicCardDefinitions'
import { getItemCard } from '@data/ItemCardDefinitions'
import { drawRelicOptions } from '@data/RelicPool'
import type { HandCard } from '@entities/Card'
import type { Relic } from '@entities/Relic'

const BASIC_ATTACK_DAMAGE = 2
const RELIC_CHOICE_COUNT = 3
// Capture ("넌 내꺼야!") only claims enemies at or below this fraction of
// max hp (bosses will use a stricter one later).
const CAPTURE_THRESHOLD = 0.25
// While a hand card is held or a skill is armed the whole game clock crawls,
// giving the player a slow-motion beat to read the board and aim.
const AIM_TIME_SCALE = 0.3

export class Game {
  private readonly handSystem = new HandSystem()
  private readonly relicSystem = new RelicSystem()
  private readonly coinSystem = new CoinSystem()
  private readonly playerSystem = new PlayerSystem()
  private readonly defenderSystem = new DefenderSystem()
  private readonly graveyardSystem = new GraveyardSystem()
  private readonly corpseSystem = new CorpseSystem()
  private readonly waveSystem = new WaveSystem(this.defenderSystem)
  private readonly abilitySystem = new AbilitySystem()
  private readonly tickManager = new TickManager()
  private readonly blast = new BlastManager()
  private readonly board: BoardRenderer
  private readonly hand: CardHand
  private readonly relics: RelicInventory
  private readonly coins: CoinPanel
  private readonly hive: SkillHive
  private readonly rewardOverlay: RewardOverlay
  private readonly shopOverlay: ShopOverlay
  private readonly defeatOverlay: DefeatOverlay
  // Epic permanent upgrades to the player's own casts.
  private basicDamageBonus = 0
  private ultimateDamageBonus = 0
  private readonly inspector: CardInspector
  private readonly mergeButton: MergeButton
  private readonly cellMergeButton: CellMergeButton
  private readonly graveyard: GraveyardPanel
  private readonly shellEl: HTMLElement
  private mergeInProgress = false
  private aiming = false
  // Which toggle skill is armed (raise/capture aim at a cell; null/basic =
  // plain click-to-attack). raise-all fires immediately and never stays armed.
  private armedAbility: AbilityId | null = null
  private hoverHideTimer: number | null = null
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
    this.cellMergeButton = new CellMergeButton(shell, () => this.performCellMerge())
    this.graveyard = new GraveyardPanel(shell)
    this.board = new BoardRenderer(
      boardMount,
      this.waveSystem,
      this.defenderSystem,
      (cellIndex) => this.handleCellClick(cellIndex),
      (cellIndex) => this.handleCellHover(cellIndex)
    )
    this.hive = new SkillHive(shell, this.abilitySystem, {
      onSkill: (id) => this.handleSkill(id),
    })
    this.rewardOverlay = new RewardOverlay({
      onChoose: (relic, cardEl) => this.resolveRelicChoice(relic, cardEl),
    })
    this.shopOverlay = new ShopOverlay({
      onBuy: (offer, cardEl) => this.buyShopOffer(offer, cardEl),
      onLeave: () => this.resumeRun(),
    })
    new AbyssAmbience(shell)
    this.defeatOverlay = new DefeatOverlay(shell)
    new IntroOverlay(shell, () => this.startRun())

    this.waveSystem.onChange(() => this.board.syncCells())
    this.waveSystem.onEncounter((result) => this.handleEncounter(result))
    this.waveSystem.onCheckpoint((info) => this.handleCheckpoint(info))
    this.waveSystem.onClash((info) => this.handleClash(info))
    this.waveSystem.onPlayerHit((info) => this.handlePlayerHit(info))
    this.waveSystem.onPassive((e) => this.handlePassive(e))
    this.defenderSystem.onPassive((e) => this.handlePassive(e))
    this.playerSystem.onChange(() =>
      this.board.setPlayerHp(this.playerSystem.getHp(), this.playerSystem.getMaxHp())
    )
    this.playerSystem.onDefeat(() => this.handleDefeat())
    this.defenderSystem.onChange(() => {
      this.board.syncCells()
      this.refreshCellMerge()
    })
    this.defenderSystem.onAllyDeath((e) => this.handleAllyDeath(e))
    this.graveyardSystem.onChange(() => this.graveyard.render(this.graveyardSystem.getStars()))
    this.corpseSystem.onChange(() => this.board.syncCorpses(this.corpseSystem.getCorpses()))
    this.corpseSystem.onDecayShard((c) => this.handleCorpseShard(c))
    this.handSystem.onChange(() => this.handleHandChange())
    this.relicSystem.onChange((relics) => this.relics.render(relics))
    this.coinSystem.onChange((coins) => this.coins.render(coins))
    this.abilitySystem.onChange(() => this.hive.render())

    this.hand.render(this.handSystem.getCards(), this.handSystem.getSelectedId())
    this.relics.render(this.relicSystem.getRelics())
    this.coins.render(this.coinSystem.getCoins())
    this.graveyard.render(this.graveyardSystem.getStars())
    this.hive.render()
  }

  /** Selection drives everything aim-related: the fan re-render, placement
   * targeting, the inspector panel, the backdrop dim, and slow motion. */
  private handleHandChange(): void {
    const selected = this.handSystem.getSelectedCard()
    // Selecting a card and arming a skill are mutually exclusive modes.
    if (selected && this.armedAbility) this.disarmSkill()
    this.hand.render(this.handSystem.getCards(), this.handSystem.getSelectedId())
    this.mergeButton.setVisible(!this.mergeInProgress && !!this.handSystem.findTriple())

    if (selected) this.inspector.show(selected)
    else this.inspector.hide()
    this.updateAimState()
  }

  /** Whether either targeting mode is active — a held hand card or an armed
   * raise/capture skill. raise-all fires instantly and never arms. */
  private isTargeting(): boolean {
    return !!this.handSystem.getSelectedCard() || this.armedAbility === 'raise' || this.armedAbility === 'capture'
  }

  /** Recomputes aim mode from the current card/skill selection: darken all
   * but the board, crawl the clock, light the target cells. */
  private updateAimState(): void {
    const active = this.isTargeting()
    this.board.setPlacementTargeting(active)
    this.setAiming(active)
  }

  /** Aim mode: darken everything but the board and crawl the game clock —
   * a held breath while choosing where to aim. */
  private setAiming(active: boolean): void {
    if (this.aiming === active) return
    this.aiming = active
    this.shellEl.classList.toggle('is-aiming', active)
    const scale = active ? AIM_TIME_SCALE : 1
    this.tickManager.setRate(scale)
    this.waveSystem.setTimeScale(scale)
    this.refreshCellMerge()
  }

  /** A hex was pressed. Basic disarms to plain attack, raise/capture toggle
   * their armed aim mode, raise-all fires at once. */
  private handleSkill(id: AbilityId): void {
    if (!this.runStarted) return
    if (id === 'basic') {
      this.disarmSkill()
      return
    }
    if (id === 'raise-all') {
      this.castRaiseAll()
      return
    }
    // raise / capture — toggle arm.
    if (this.armedAbility === id) {
      this.disarmSkill()
      return
    }
    if (this.handSystem.getSelectedId()) this.handSystem.clearSelection()
    this.armedAbility = id
    this.hive.setArmed(id)
    this.updateAimState()
  }

  private disarmSkill(): void {
    if (this.armedAbility === null) return
    this.armedAbility = null
    this.hive.setArmed(null)
    this.updateAimState()
  }

  boot(): void {
    this.board.render()
  }

  /** Hover-to-inspect on the board. Ignored while aiming (the selected hand
   * card owns the inspector then). A tiny hide-debounce keeps the panel
   * steady while the cursor slides between adjacent cells. */
  private handleCellHover(cellIndex: number | null): void {
    if (this.handSystem.getSelectedId()) return
    if (this.hoverHideTimer !== null) {
      window.clearTimeout(this.hoverHideTimer)
      this.hoverHideTimer = null
    }
    if (cellIndex === null) {
      this.hoverHideTimer = window.setTimeout(() => this.inspector.hide(), 60)
      return
    }
    const data = this.buildCellInspect(cellIndex)
    if (data) this.inspector.render(data)
    else this.inspector.hide()
  }

  /** What to show for a hovered cell: front enemy > front ally > player
   * (boss room) > cell buffs > nothing. Units carry their live attack/hp
   * and signature passive; any trap-star stacks on the cell append as an
   * active-buff line. */
  private buildCellInspect(cellIndex: number): InspectorData | null {
    const isBoss = cellIndex === BOSS_CELL_INDEX
    const trapCount = isBoss ? 0 : this.waveSystem.getCellTraps()[cellIndex]
    const buffs = trapCount > 0 ? `함정별 ×${trapCount} · 진입 시 ${trapCount} 피해` : undefined

    const enemy = this.waveSystem.getFrontEnemy(cellIndex)
    if (enemy) {
      const creature = getCreature(enemy.creatureId)
      return {
        imageUrl: creature?.enemyArt,
        title: creature?.label ?? '심연의 것',
        tag: '적',
        stats: [
          { label: '공격', value: `${this.waveSystem.getEnemyAttack()}` },
          { label: '체력', value: `${enemy.hp}/${enemy.maxHp}` },
        ],
        passive: creature?.passive,
        buffs,
      }
    }

    const ally = this.defenderSystem.getFrontAlly(cellIndex)
    if (ally) {
      const creature = ally.creatureId ? getCreature(ally.creatureId) : undefined
      return {
        imageUrl: creature?.allyArt,
        title: ally.label,
        stars: ally.tier ?? 1,
        tag: ally.tier === 2 ? '아군 디펜더 · 2성' : '아군 디펜더',
        stats: [
          { label: '공격', value: `${this.defenderSystem.getAttack(cellIndex) ?? 0}` },
          { label: '체력', value: `${ally.hp}/${ally.maxHp}` },
        ],
        passive: creature?.passive,
        buffs,
      }
    }

    if (isBoss) {
      return {
        imageUrl: playerArtUrl,
        title: '넥슈',
        tag: '사령술사',
        stats: [
          { label: '기본', value: `${BASIC_ATTACK_DAMAGE + this.basicDamageBonus}` },
          { label: '체력', value: `${this.playerSystem.getHp()}/${this.playerSystem.getMaxHp()}` },
        ],
        desc: '심연의 사령술사. 사령 게이지로 급조 부활·전체 부활·포획을 시전한다.',
      }
    }

    // Empty grid cell — only worth showing if it carries an active buff.
    if (buffs) {
      return { title: '심연의 자리', tag: '칸 효과', buffs }
    }
    return null
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

    // An armed toggle skill consumes the click at the aimed cell.
    if (this.armedAbility === 'raise') {
      this.castRaise(cellIndex)
      return
    }
    if (this.armedAbility === 'capture') {
      this.castCapture(cellIndex)
      return
    }

    // Plain basic attack — no arming. Nothing fires during a checkpoint lull;
    // leftover enemies just stand there until the player proceeds.
    if (this.waveSystem.isPaused()) return
    if (!this.abilitySystem.tryCast('basic')) return
    this.castBasicAttack(cellIndex)
  }

  /** "얘들아…! 막아!" — raise every corpse on the aimed cell (up to its free
   * slots) as hasty undead. No corpses / no room / no gauge = no spend. */
  private castRaise(cellIndex: number): void {
    const capacity = this.defenderSystem.freeSlots(cellIndex)
    const available = this.corpseSystem.corpsesInCell(cellIndex).length
    if (available === 0 || capacity === 0) {
      this.disarmSkill()
      return
    }
    if (!this.abilitySystem.tryCast('raise')) {
      this.disarmSkill()
      return
    }
    for (const corpse of this.corpseSystem.takeCell(cellIndex, capacity)) {
      this.defenderSystem.placeRaised(cellIndex, getCreature(corpse.creatureId)?.label ?? corpse.label, corpse.creatureId)
    }
    const rect = this.board.getCellRect(cellIndex)
    if (rect) this.blast.passiveBurst(rect, 'shield')
    this.disarmSkill()
  }

  /** "모두 일어나!" — raise every corpse on the field at once. */
  private castRaiseAll(): void {
    if (!this.runStarted || this.waveSystem.isPaused()) return
    if (!this.corpseSystem.hasAny()) return
    if (!this.abilitySystem.tryCast('raise-all')) return
    for (const corpse of this.corpseSystem.takeAll()) {
      if (this.defenderSystem.freeSlots(corpse.cellIndex) <= 0) continue
      this.defenderSystem.placeRaised(corpse.cellIndex, getCreature(corpse.creatureId)?.label ?? corpse.label, corpse.creatureId)
      const rect = this.board.getCellRect(corpse.cellIndex)
      if (rect) this.blast.passiveBurst(rect, 'shield')
    }
  }

  /** "넌 내꺼야!" — execute the aimed cell's front enemy if it's weak enough,
   * claiming a guaranteed necro card. No valid target = no spend. */
  private castCapture(cellIndex: number): void {
    if (!this.waveSystem.isCapturable(cellIndex, CAPTURE_THRESHOLD)) {
      this.disarmSkill()
      return
    }
    if (!this.abilitySystem.tryCast('capture')) {
      this.disarmSkill()
      return
    }
    const captured = this.waveSystem.captureFrontEnemy(cellIndex, CAPTURE_THRESHOLD)
    if (captured) {
      const creature = getCreature(captured.creatureId)
      const rect = this.board.getCellRect(cellIndex)
      const from = rect ? centerOf(rect) : this.hand.getNextSlotPoint(1)
      const target = this.hand.getNextSlotPoint(this.handSystem.getCards().length + 1)
      this.blast.starFly(from, target, () =>
        this.handSystem.addCard({
          id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          label: creature?.label ?? '심연의 것',
          creatureId: captured.creatureId,
        })
      )
    }
    this.disarmSkill()
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

  private handleEncounter(result: EncounterResult): void {
    const rect = this.board.getCellRect(result.cellIndex)
    this.board.playDefeatFx(result.cellIndex)
    if (result.viaBossRoom) this.board.pulseBossRoom()
    // Slaying feeds the sacral gauge.
    this.abilitySystem.chargeFromKill()

    // 25% of kills hand over the creature's whole card; the rest leave a
    // corpse on the cell to raise ("얘들아…! 막아!") or let rot into a shard.
    if (rect && result.outcome === 'card') {
      const creature = getCreature(result.creatureId)
      const nextCount = this.handSystem.getCards().length + 1
      const target = this.hand.getNextSlotPoint(nextCount)
      const id = `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      this.blast.travelDrop(rect, target, () => {
        this.handSystem.addCard({ id, label: creature?.label ?? '심연의 것', creatureId: result.creatureId })
      })
    } else if (result.outcome === 'corpse') {
      const creature = getCreature(result.creatureId)
      this.corpseSystem.add(result.cellIndex, result.creatureId, creature?.label ?? '심연의 것')
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

  /** A creature passive fired on a cell — play its themed blast there.
   * jelly-amp: an electric spark; rabbit-heal: a green heal bloom. */
  private handlePassive(e: PassiveEvent): void {
    const rect = this.board.getCellRect(e.cellIndex)
    if (!rect) return
    const kind = e.passiveId === 'jelly-amp' ? 'spark' : e.passiveId === 'rabbit-heal' ? 'heal' : 'shield'
    this.blast.passiveBurst(rect, kind)
  }

  /** Shows the cell-merge button over the first cell holding a same-creature
   * trio (hidden while aiming or mid-hand-merge). Re-run on every defender
   * change and aim toggle. */
  private refreshCellMerge(): void {
    if (this.aiming) {
      this.cellMergeButton.hide()
      return
    }
    const cellIndex = this.defenderSystem.findCellTriple()
    if (cellIndex === null) {
      this.cellMergeButton.hide()
      return
    }
    const rect = this.board.getCellRect(cellIndex)
    if (!rect) {
      this.cellMergeButton.hide()
      return
    }
    this.cellMergeButton.showAt(rect.left + rect.width / 2, rect.top + 6)
  }

  /** Fuses the on-board trio into a 2-star ally with a blast at that cell. */
  private performCellMerge(): void {
    const cellIndex = this.defenderSystem.findCellTriple()
    if (cellIndex === null) return
    const rect = this.board.getCellRect(cellIndex)
    if (this.defenderSystem.mergeCellTriple(cellIndex) && rect) {
      this.blast.clashBurst(rect)
    }
    this.refreshCellMerge()
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

  /** Each 3-wave round ends in a lull: hasty undead crumble to shards, any
   * armed skill disarms, then the sparkling center shop unfolds — except
   * every 3rd checkpoint, which offers a relic pick instead. */
  private handleCheckpoint(info: CheckpointInfo): void {
    this.disarmSkill()
    this.defenderSystem.purgeRaised()
    if (info.isRelicCheckpoint) {
      this.rewardOverlay.show(drawRelicOptions(RELIC_CHOICE_COUNT))
    } else {
      this.shopOverlay.show()
    }
  }

  /** A neglected corpse sank and left a shard — fly it to the graveyard. */
  private handleCorpseShard(c: Corpse): void {
    const rect = this.board.getCellRect(c.cellIndex)
    const from = rect ? centerOf(rect) : this.graveyard.getDropPoint()
    this.blast.starFly(from, this.graveyard.getDropPoint(), () =>
      this.graveyardSystem.addStar(c.creatureId, c.label)
    )
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
    this.resumeRun()

    this.blast.travelDrop(cardEl.getBoundingClientRect(), target, () => this.relicSystem.addRelic(relic))
  }

  /** Leaving the round-end lull: reclaim any graveyard triples as cards,
   * then let the waves push again. */
  private resumeRun(): void {
    this.reclaimGraveyardTriples()
    this.waveSystem.resumeFromCheckpoint()
  }

  /** A fallen ally rises as a gold star and drifts to the graveyard dock. */
  private handleAllyDeath(e: AllyDeath): void {
    const rect = this.board.getCellRect(e.cellIndex)
    const from = rect ? centerOf(rect) : this.graveyard.getDropPoint()
    this.blast.starFly(from, this.graveyard.getDropPoint(), () =>
      this.graveyardSystem.addStar(e.creatureId, e.label)
    )
  }

  /** Round-end recovery: every three same-creature stars fuse back into one
   * whole card, each flying from the graveyard into the hand. */
  private reclaimGraveyardTriples(): void {
    const reclaimed = this.graveyardSystem.combineTriples()
    reclaimed.forEach((card, i) => {
      window.setTimeout(() => {
        const from = this.graveyard.getDropPoint()
        const nextCount = this.handSystem.getCards().length + 1
        const target = this.hand.getNextSlotPoint(nextCount)
        this.blast.starFly(from, target, () =>
          this.handSystem.addCard({
            id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            label: card.label,
            creatureId: card.creatureId,
          })
        )
      }, i * 260)
    })
  }
}

function centerOf(rect: DOMRect): { x: number; y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}
