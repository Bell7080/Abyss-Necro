import { AbyssAmbience } from '@ui/AbyssAmbience'
import { BoardRenderer } from '@ui/BoardRenderer'
import { CardHand } from '@ui/CardHand'
import { CardInspector, type InspectorData } from '@ui/CardInspector'
import { CodexOverlay } from '@ui/CodexOverlay'
import { CoinPanel } from '@ui/CoinPanel'
import { CosmosLayer } from '@ui/CosmosLayer'
import { DefeatOverlay } from '@ui/DefeatOverlay'
import { IntroDialogue } from '@ui/IntroDialogue'
import { IntroOverlay } from '@ui/IntroOverlay'
import { MergeButton } from '@ui/MergeButton'
import { RelicInventory } from '@ui/RelicInventory'
import { RewardOverlay } from '@ui/RewardOverlay'
import { ShopOverlay, type ShopOffer } from '@ui/ShopOverlay'
import { SkillCastPanel } from '@ui/SkillCastPanel'
import { SKILL_FACES, getSkillArt } from '@ui/SkillArt'
import { SkillHive } from '@ui/SkillHive'
import { VictoryOverlay } from '@ui/VictoryOverlay'
import { VolumeControl } from '@ui/VolumeControl'
import { WaveHud } from '@ui/WaveHud'
import { BlastManager } from '@ui/effects/BlastManager'
import { BubbleBolt } from '@ui/effects/BubbleBolt'
import { showDamageNumber, showFloatingLabel } from '@ui/effects/FloatingDamage'
import { AbilitySystem, type AbilityId } from '@systems/AbilitySystem'
import { AudioManager } from '@systems/AudioManager'
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
import { getCreature, getAllyArt } from '@data/CreatureDefinitions'
import { getEpicCard } from '@data/EpicCardDefinitions'
import { getItemCard, randomItemCard } from '@data/ItemCardDefinitions'
import { summonCost } from '@data/Tiers'
import { drawRelicOptions } from '@data/RelicPool'
import type { HandCard } from '@entities/Card'
import type { Relic } from '@entities/Relic'

const BASIC_ATTACK_DAMAGE = 4
const RELIC_CHOICE_COUNT = 3
const EMPTY_ID_SET: ReadonlySet<string> = new Set()
// While a hand card is held or a skill is armed the whole game clock crawls,
// giving the player a slow-motion beat to read the board and aim.
const AIM_TIME_SCALE = 0.3
// A kill has this independent, modest chance to ALSO drop a usable item card
// (on top of whichever necro-card/corpse outcome it already rolled) — items
// are otherwise shop-only, but a rare kill-drop sprinkle was always part of
// the loop.
const ITEM_DROP_CHANCE = 0.12

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
  private readonly audio = new AudioManager()
  private readonly blast = new BlastManager()
  private readonly board: BoardRenderer
  private readonly hand: CardHand
  private readonly relics: RelicInventory
  private readonly coins: CoinPanel
  private readonly waveHud: WaveHud
  private readonly hive: SkillHive
  private readonly skillCast: SkillCastPanel
  private readonly rewardOverlay: RewardOverlay
  private readonly shopOverlay: ShopOverlay
  private readonly defeatOverlay: DefeatOverlay
  private readonly victoryOverlay: VictoryOverlay
  // Latches once the climax boss falls/gets captured so the 1st-ending veil
  // fires exactly once.
  private runWon = false
  // Epic permanent upgrade to the player's basic attack.
  private basicDamageBonus = 0
  private readonly inspector: CardInspector
  private readonly mergeButton: MergeButton
  private readonly cosmos: CosmosLayer
  private readonly shellEl: HTMLElement
  private mergeInProgress = false
  // Which merge the central 합성 button will perform when pressed — a hand
  // trio or an on-board cell trio (whichever is currently available).
  private mergeTarget: { type: 'hand' } | { type: 'cell'; cellIndex: number } | null = null
  private aiming = false
  // Which toggle skill is armed (raise/capture aim at a cell; null/basic =
  // plain click-to-attack). raise-all fires immediately and never stays armed.
  private armedAbility: AbilityId | null = null
  private hoverHideTimer: number | null = null
  // Last cell handleCellHover actually rendered for — a corpse figure's
  // pointer-events:auto hit-area sitting on top of its cell button can toggle
  // that button's mouseenter/mouseleave rapidly as the cursor crosses its
  // (irregular, masked) shape, so without this guard the inspector data got
  // torn down and rebuilt on every one of those, flickering its glow.
  private lastHoveredCell: number | null = null
  // Last wave the cosmos was settled for — cascade fires once per new wave.
  private lastCascadeWave = 1
  // Every creature the player has ever held as a necro card this run —
  // the checkpoint shop only stocks minions from this set.
  private readonly capturedCreatures = new Set<string>()
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

    this.waveHud = new WaveHud(shell, this.waveSystem)
    this.coins = new CoinPanel(shell)

    this.inspector = new CardInspector(shell)
    // Relics keep a fixed dock at the bottom-right, always visible —
    // independent of the inspector, which only exists while aiming.
    const relicDock = document.createElement('div')
    relicDock.className = 'relic-dock'
    shell.appendChild(relicDock)
    this.relics = new RelicInventory(relicDock)
    this.hand = new CardHand(shell, (cardId) => {
      // Hand cards are placement, not shopping — locked out during the
      // checkpoint lull (only merge/purchase are allowed there).
      if (this.waveSystem.isPaused()) return
      this.handSystem.toggleSelect(cardId)
    })
    this.mergeButton = new MergeButton(shell, () => this.performActiveMerge())
    this.cosmos = new CosmosLayer(shell)
    this.board = new BoardRenderer(
      boardMount,
      this.waveSystem,
      this.defenderSystem,
      (cellIndex) => this.handleCellClick(cellIndex),
      (cellIndex) => this.handleCellHover(cellIndex),
      (corpseId) => this.handleCorpseClick(corpseId)
    )
    this.hive = new SkillHive(shell, this.abilitySystem, {
      onSkill: (id) => this.handleSkill(id),
      onHover: (id) => this.handleSkillHover(id),
    })
    this.skillCast = new SkillCastPanel(shell)
    this.rewardOverlay = new RewardOverlay({
      onChoose: (relic, cardEl) => this.resolveRelicChoice(relic, cardEl),
    })
    this.shopOverlay = new ShopOverlay({
      onBuy: (offer, cardEl) => this.buyShopOffer(offer, cardEl),
      onLeave: () => this.resumeRun(),
    })
    new AbyssAmbience(shell)
    new CodexOverlay(shell)
    this.defeatOverlay = new DefeatOverlay(shell)
    this.victoryOverlay = new VictoryOverlay(shell)
    // One persistent top-right volume slider for the whole session — title,
    // tutorial dialogue, and in-game alike (nothing else uses that corner).
    const volumeCtrl = new VolumeControl(shell, {
      initial: this.audio.getMasterVolume(),
      onChange: (v) => this.audio.setMasterVolume(v),
    })

    new IntroOverlay(
      shell,
      () => this.startIntroDialogue(),
      () => {
        this.audio.playOst()
        volumeCtrl.reveal()
      },
      () => this.audio.duckTitleOst()
    )

    this.waveSystem.onChange(() => {
      this.board.syncCells()
      this.refreshAimTargets()
      // Every new wave settles the cosmos (조각3→파편, 파편3→온전한 카드) —
      // recovered value flows back each wave, not only at checkpoint lulls.
      const wave = this.waveSystem.getWaveNumber()
      if (wave !== this.lastCascadeWave) {
        this.lastCascadeWave = wave
        this.cascadeCosmos()
      }
    })
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
      this.refreshMerge()
    })
    this.defenderSystem.onAllyDeath((e) => this.handleAllyDeath(e))
    this.graveyardSystem.onChange(() => this.cosmos.render(this.graveyardSystem.getSouls()))
    this.corpseSystem.onChange(() => {
      this.board.syncCorpses(this.corpseSystem.getCorpses())
      if (this.armedAbility === 'raise') this.refreshAimTargets()
    })
    this.corpseSystem.onDecayShard((c) => this.handleCorpseShard(c))
    this.handSystem.onChange(() => this.handleHandChange())
    this.relicSystem.onChange((relics) => this.relics.render(relics))
    this.coinSystem.onChange((coins) => this.coins.render(coins))
    this.abilitySystem.onChange(() => {
      this.hive.render()
      this.hand.refreshAffordability((c) => this.canAffordCard(c))
    })

    this.hand.render(this.handSystem.getCards(), this.handSystem.getSelectedId(), (c) => this.canAffordCard(c))
    this.relics.render(this.relicSystem.getRelics())
    this.coins.render(this.coinSystem.getCoins())
    this.cosmos.render(this.graveyardSystem.getSouls())
    this.hive.render()
  }

  /** Selection drives everything aim-related: the fan re-render, placement
   * targeting, the inspector panel, the backdrop dim, and slow motion. */
  private handleHandChange(): void {
    // Every necro card passes through the hand at least once (kill drop,
    // capture, cascade, death-return) — union them here so the shop knows
    // which creatures the player has actually claimed.
    for (const c of this.handSystem.getCards()) {
      if (c.creatureId && c.kind !== 'item' && c.kind !== 'epic') {
        this.capturedCreatures.add(c.creatureId)
      }
    }
    const selected = this.handSystem.getSelectedCard()
    // Selecting a card and arming a skill are mutually exclusive modes.
    if (selected && this.armedAbility) this.disarmSkill()
    this.hand.render(this.handSystem.getCards(), this.handSystem.getSelectedId(), (c) => this.canAffordCard(c))

    if (selected) this.inspector.show(selected)
    else this.inspector.hide()
    this.updateAimState()
    this.refreshMerge()
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

  /** The live game-speed multiplier — 1 normally, AIM_TIME_SCALE while aiming.
   * Effects fired mid-cast (e.g. the capture snipe bolt) scale their own
   * duration against this so they crawl along with everything else instead of
   * zipping past at full speed inside the slow-mo. */
  private currentTimeScale(): number {
    return this.aiming ? AIM_TIME_SCALE : 1
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
    this.corpseSystem.setTimeScale(scale)
    // Drives every CSS transition/animation keyed to var(--time-scale) — the
    // enemy move slide included — so the whole game visibly slows, not just
    // the gap between ticks.
    this.shellEl.style.setProperty('--time-scale', String(scale))
    this.refreshMerge()
  }

  /** A hex was pressed. Basic disarms to plain attack, raise/capture toggle
   * their armed aim mode, raise-all fires at once. Locked out entirely during
   * the checkpoint lull — only merge/purchase are allowed there. */
  private handleSkill(id: AbilityId): void {
    if (!this.runStarted || this.waveSystem.isPaused()) return
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
    this.refreshAimTargets()
  }

  private disarmSkill(): void {
    if (this.armedAbility === null) return
    this.armedAbility = null
    this.hive.setArmed(null)
    this.updateAimState()
    this.refreshAimTargets()
  }

  /** Aim-mode target emphasis. 포획 lights the weak-enough ENEMIES themselves
   * (bosses need a stricter cut); 급조 lights the raisable CORPSES themselves.
   * Neither ever rings a floor tile — the target is always the actual entity.
   * Both clear when their skill isn't armed. */
  private refreshAimTargets(): void {
    if (this.armedAbility === 'capture') {
      const ids = new Set<string>()
      for (const idx of this.waveSystem.getAliveCellIndices()) {
        if (!this.waveSystem.isCapturable(idx)) continue
        const front = this.waveSystem.getFrontEnemy(idx)
        if (front) ids.add(front.id)
      }
      this.board.setCaptureTargets(ids)
    } else {
      this.board.setCaptureTargets(EMPTY_ID_SET)
    }

    if (this.armedAbility === 'raise') {
      const ids = new Set(
        this.corpseSystem
          .getCorpses()
          .filter((c) => this.defenderSystem.freeSlots(c.cellIndex) > 0)
          .map((c) => c.id)
      )
      this.board.setRaiseTargets(ids)
    } else {
      this.board.setRaiseTargets(EMPTY_ID_SET)
    }
  }

  boot(): void {
    this.board.render()
    // Sync the necromancer's hp/xx text immediately — otherwise it shows the
    // placeholder 1/1 until the first change event.
    this.board.setPlayerHp(this.playerSystem.getHp(), this.playerSystem.getMaxHp())
    // The OST now starts once the intro title scene finishes revealing itself
    // (IntroOverlay's onRevealed callback), not immediately at boot.
  }

  /** Hovering a skill hex reuses the same right-side inspector as board/hand
   * hover — cost, catchphrase, and a plain description of what it does. */
  private handleSkillHover(id: AbilityId | null): void {
    if (id === null) {
      this.inspector.hide()
      return
    }
    const face = SKILL_FACES[id]
    this.inspector.render({
      imageUrl: getSkillArt(id),
      title: face.name,
      tag: '스킬',
      stats: [{ label: '게이지', value: `${this.abilitySystem.costOf(id)}` }],
      desc: face.hint,
      passive: face.desc,
    })
  }

  /** Hover-to-inspect on the board. Ignored while aiming (the selected hand
   * card owns the inspector then). A tiny hide-debounce keeps the panel
   * steady while the cursor slides between adjacent cells. */
  private handleCellHover(cellIndex: number | null): void {
    if (this.handSystem.getSelectedId()) return
    if (cellIndex === this.lastHoveredCell) return
    this.lastHoveredCell = cellIndex
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

  /** What to show for a hovered cell: front ally > player (boss room) >
   * cell buffs > nothing. Units carry their live attack/hp and signature
   * passive; any trap-star stacks on the cell append as an active-buff line.
   * Enemies are deliberately NOT hover-inspectable — mousing across the tide
   * shouldn't flood the panel; their profile shows on a direct click instead
   * (see buildEnemyInspect in handleCellClick). */
  private buildCellInspect(cellIndex: number): InspectorData | null {
    const isBoss = cellIndex === BOSS_CELL_INDEX
    const trapCount = isBoss ? 0 : this.waveSystem.getCellTraps()[cellIndex]
    const buffs = trapCount > 0 ? `함정별 ×${trapCount} · 진입 시 ${trapCount} 피해` : undefined

    const ally = this.defenderSystem.getFrontAlly(cellIndex)
    if (ally) {
      const creature = ally.creatureId ? getCreature(ally.creatureId) : undefined
      return {
        imageUrl: creature ? getAllyArt(creature.id, ally.tier ?? 1) : undefined,
        title: ally.label,
        stars: ally.raised ? undefined : ally.tier ?? 1,
        tag: ally.raised ? '급조 언데드' : (ally.tier ?? 1) >= 2 ? '아군 디펜더 · 진화체' : '아군 디펜더',
        stats: [
          { label: '공격', value: `${this.defenderSystem.getAttack(cellIndex) ?? 0}` },
          { label: '체력', value: `${ally.hp}/${ally.maxHp}` },
        ],
        passive: ally.raised ? undefined : creature?.passive,
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

  /** The cell's front enemy as inspector data — click-to-inspect only. */
  private buildEnemyInspect(cellIndex: number): InspectorData | null {
    const enemy = this.waveSystem.getFrontEnemy(cellIndex)
    if (!enemy) return null
    const trapCount = cellIndex === BOSS_CELL_INDEX ? 0 : this.waveSystem.getCellTraps()[cellIndex]
    const creature = getCreature(enemy.creatureId)
    return {
      imageUrl: creature?.enemyArt,
      title: enemy.label ?? creature?.label ?? '심연의 것',
      tag: enemy.isBoss ? '엘리트 보스' : '적',
      stats: [
        { label: '공격', value: `${enemy.attack ?? this.waveSystem.getEnemyAttack()}` },
        { label: '체력', value: `${enemy.hp}/${enemy.maxHp}` },
      ],
      passive: creature?.enemyPassive,
      buffs: trapCount > 0 ? `함정별 ×${trapCount} · 진입 시 ${trapCount} 피해` : undefined,
    }
  }

  /** Fired once the title/board reveal finishes — plays 넥슈's opening
   * cutscene, which itself calls startRun() once its countdown lands. */
  private startIntroDialogue(): void {
    new IntroDialogue(this.shellEl, {
      getWaveTimeRect: () => this.waveHud.getTimeRect(),
      onComplete: () => this.startRun(),
    })
  }

  /** Fired once the intro dialogue's countdown lands — nothing spawns or
   * moves before this. */
  private startRun(): void {
    this.runStarted = true
    // The dialogue cutscene hands off from the OST to a random battle loop.
    this.audio.startBattle()
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

    // A plain click on an enemy's cell is the ONLY way to open its profile
    // (hover deliberately doesn't) — shown regardless of whether the attack
    // below actually fires. Hover-leave clears it like any inspection.
    const enemyInspect = this.buildEnemyInspect(cellIndex)
    if (enemyInspect) this.inspector.render(enemyInspect)

    // Plain basic attack — no arming. Nothing fires during a checkpoint lull;
    // leftover enemies just stand there until the player proceeds.
    if (this.waveSystem.isPaused()) return
    if (!this.abilitySystem.tryCast('basic')) return
    this.castBasicAttack(cellIndex)
  }

  /** "얘들아…! 막아!" core: turns ONE specific corpse into a hasty undead in its
   * own cell (never the whole cell's stack) — the cast/fx shared by both the
   * direct corpse-click shortcut and the armed-hex fallback below. Assumes the
   * cost/slot checks already passed. */
  private performRaise(corpse: Corpse): void {
    this.corpseSystem.takeOne(corpse.id)
    this.defenderSystem.placeRaised(corpse.cellIndex, getCreature(corpse.creatureId)?.label ?? corpse.label, corpse.creatureId)
    this.board.playerCast('hop')
    this.skillCast.show('raise')
    this.hive.flashCast('raise')
    const rect = this.board.getCellRect(corpse.cellIndex)
    if (rect) this.blast.passiveBurst(rect, 'shield')
  }

  /** Fallback when 급조 is armed and the player clicks a CELL rather than the
   * precise corpse figure — raises the first raisable corpse there. */
  private castRaise(cellIndex: number): void {
    const corpse = this.corpseSystem.corpsesInCell(cellIndex)[0]
    // Missed the target (no corpse here) — stay armed rather than cancelling.
    if (!corpse || this.defenderSystem.freeSlots(cellIndex) <= 0) return
    if (!this.abilitySystem.tryCast('raise')) {
      this.disarmSkill()
      return
    }
    this.performRaise(corpse)
    this.disarmSkill()
  }

  /** Clicking a corpse directly is the primary way to raise it — works with or
   * without 급조 armed first, and disarms it never was. A selected hand card or
   * armed 포획 defer to the normal cell click instead (placement/capture win). */
  private handleCorpseClick(corpseId: string): void {
    if (!this.runStarted) return
    const corpse = this.corpseSystem.getCorpses().find((c) => c.id === corpseId)
    if (!corpse) return
    if (this.handSystem.getSelectedCard() || this.armedAbility === 'capture') {
      this.handleCellClick(corpse.cellIndex)
      return
    }
    const wasArmed = this.armedAbility === 'raise'
    if (this.defenderSystem.freeSlots(corpse.cellIndex) <= 0) return
    if (!this.abilitySystem.tryCast('raise')) {
      if (wasArmed) this.disarmSkill()
      return
    }
    this.performRaise(corpse)
    if (wasArmed) this.disarmSkill()
  }

  /** "모두 일어나!" — raise every corpse on the field at once. */
  private castRaiseAll(): void {
    if (!this.runStarted || this.waveSystem.isPaused()) return
    if (!this.corpseSystem.hasAny()) return
    if (!this.abilitySystem.tryCast('raise-all')) return
    this.board.playerCast('hop')
    this.skillCast.show('raise-all')
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
    if (!this.waveSystem.isCapturable(cellIndex)) {
      this.disarmSkill()
      return
    }
    if (!this.abilitySystem.tryCast('capture')) {
      this.disarmSkill()
      return
    }
    // 저격 — recoil and fire a bolt from the card at the marked enemy.
    this.board.playerCast('recoil')
    this.skillCast.show('capture')
    const muzzle = this.board.getPlayerCardRect() ?? this.board.getPlayerRect()
    const targetRect = this.board.getCellRect(cellIndex)
    if (muzzle && targetRect) {
      const o = centerOf(muzzle)
      const t = centerOf(targetRect)
      // Scales with the aim-mode slow-mo (still active here, just before disarm)
      // so the snipe bolt doesn't zip past at full speed while everything else crawls.
      BubbleBolt.fire(o.x, o.y, t.x, t.y, { duration: 260 / this.currentTimeScale() })
    }
    const captured = this.waveSystem.captureFrontEnemy(cellIndex)
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
      // Claiming the final boss is the sacral 1st ending.
      if (captured.isFinal) this.handleVictory()
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
    // Full-summon costs sacral gauge by tier (1성 4 / 2성 7 / 3성 10). The
    // hand card is dimmed until affordable, but re-check on the cast too.
    const cost = summonCost(card.tier ?? 1)
    if (!this.abilitySystem.canAfford(cost)) return
    if (!this.defenderSystem.canPlace(cellIndex)) return
    const cellRect = this.board.getCellRect(cellIndex)
    const cardRect = this.hand.getCardRect(card.id)
    this.abilitySystem.spend(cost)
    this.handSystem.removeCard(card.id)
    if (!cardRect || !cellRect) {
      // No rect to travel from/to (shouldn't normally happen) — place plainly.
      this.defenderSystem.place(cellIndex, card.label, card.creatureId, card.tier ?? 1)
      return
    }
    // The card bubbles from its hand slot to the cell; the ally actually
    // lands (and the pop burst fires) right as the bubbles arrive.
    this.blast.travelDrop(cardRect, centerOf(cellRect), () => {
      this.defenderSystem.place(cellIndex, card.label, card.creatureId, card.tier ?? 1)
      this.blast.clashBurst(cellRect)
    })
  }

  /** Whether a hand card can be played now: item/epic are always usable, a
   * necro card needs its tier's summon cost in gauge. */
  private canAffordCard(card: HandCard): boolean {
    if (card.kind) return true
    return this.abilitySystem.canAfford(summonCost(card.tier ?? 1))
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
      this.abilitySystem.increaseMaxGauge(2)
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
    const originRect = this.board.getPlayerCardRect() ?? this.board.getPlayerRect()
    const targetRect = this.board.getCellRect(cellIndex)
    if (!originRect || !targetRect) return

    const origin = centerOf(originRect)
    const target = centerOf(targetRect)

    this.board.playerCast('recoil')
    this.skillCast.show('basic')
    this.hive.flashCast('basic')
    BubbleBolt.fire(origin.x, origin.y, target.x, target.y, {
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
      this.corpseSystem.add(
        result.cellIndex,
        result.creatureId,
        creature?.label ?? '심연의 것',
        result.fromCellIndex,
        result.movedAt
      )
    }

    // A modest independent chance to ALSO drop a usable item card, on top of
    // whichever necro-card/corpse outcome this kill already rolled.
    if (rect && Math.random() < ITEM_DROP_CHANCE) {
      const item = randomItemCard()
      const nextCount = this.handSystem.getCards().length + 1
      const target = this.hand.getNextSlotPoint(nextCount)
      const id = `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      this.blast.travelDrop(rect, target, () => {
        this.handSystem.addCard({ id, label: item.label, creatureId: '', kind: 'item', itemId: item.id })
      })
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

    // Slaying the final boss closes the 1st ending.
    if (result.isFinal) this.handleVictory()
  }

  /** The climax boss fell or was claimed — freeze the world and, after a beat
   * so the finishing blow/capture reads, raise the 1st-ending veil. Fires once. */
  private handleVictory(): void {
    if (this.runWon) return
    this.runWon = true
    this.tickManager.stop()
    this.waveSystem.halt()
    this.disarmSkill()
    // Victory returns to the OST (again from its 40s mark).
    this.audio.playOst()
    window.setTimeout(() => this.victoryOverlay.show(), 700)
  }

  /** The central 합성 button was pressed — run whichever merge is primed. */
  private performActiveMerge(): void {
    if (!this.mergeTarget || this.mergeInProgress) return
    if (this.mergeTarget.type === 'hand') this.performHandMerge()
    else this.performCellMerge(this.mergeTarget.cellIndex)
  }

  /** Three identical same-tier hand cards jelly-merge into one a tier up. The
   * fx runs first; the model swap lands on its final beat. */
  private performHandMerge(): void {
    if (this.mergeInProgress) return
    const triple = this.handSystem.findTriple()
    if (!triple) return

    this.mergeInProgress = true
    this.mergeButton.setVisible(false)
    const base = triple[0]
    const nextTier = (base.tier ?? 1) + 1
    this.hand.playMergeFx(
      triple.map((card) => card.id),
      () => {
        this.handSystem.mergeTriple(
          triple.map((card) => card.id),
          {
            id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            label: base.label,
            creatureId: base.creatureId,
            tier: nextTier,
          }
        )
        this.mergeInProgress = false
        this.refreshMerge()
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

  /** A creature passive fired on a cell — play its themed blast there. Devour
   * additionally floats a "포식! +1" so the attack-up reads. */
  private handlePassive(e: PassiveEvent): void {
    const rect = this.board.getCellRect(e.cellIndex)
    if (!rect) return
    this.blast.passiveBurst(rect, e.kind)
    if (e.kind === 'devour') {
      const c = centerOf(rect)
      showFloatingLabel(c.x, c.y - 30, '포식! +1', '#ff9a8a')
    }
  }

  /** Primes the central 합성 button and pulses the candidate cards/allies:
   * a hand trio wins over an on-board cell trio when both exist. Hidden while
   * aiming or mid-merge. Re-run on every hand/defender change and aim toggle. */
  private refreshMerge(): void {
    const clear = (): void => {
      this.mergeTarget = null
      this.mergeButton.setVisible(false)
      this.hand.setMergeCandidates([])
      this.board.setMergeCandidates([])
    }
    if (this.mergeInProgress || this.aiming) {
      clear()
      return
    }

    const triple = this.handSystem.findTriple()
    if (triple) {
      this.mergeTarget = { type: 'hand' }
      this.hand.setMergeCandidates(triple.map((c) => c.id))
      this.board.setMergeCandidates([])
      this.mergeButton.setVisible(true)
      return
    }

    const cellIndex = this.defenderSystem.findCellTriple()
    if (cellIndex !== null) {
      this.mergeTarget = { type: 'cell', cellIndex }
      const allies = cellIndex === BOSS_CELL_INDEX ? this.defenderSystem.getBossAllies() : this.defenderSystem.getCells()[cellIndex]
      this.board.setMergeCandidates(allies.map((a) => a.id))
      this.hand.setMergeCandidates([])
      this.mergeButton.setVisible(true)
      return
    }

    clear()
  }

  /** Fuses an on-board trio into one ally a tier up, with a blast at that cell. */
  private performCellMerge(cellIndex: number): void {
    const rect = this.board.getCellRect(cellIndex)
    if (this.defenderSystem.mergeCellTriple(cellIndex) && rect) {
      this.blast.clashBurst(rect)
    }
    this.refreshMerge()
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
    // Death fades the battle music out and stops it (a fresh run restarts it).
    this.audio.stopMusic()
    this.defeatOverlay.show()
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
      // Deeper waves roll better shop offers (stronger minions, more epics);
      // minions come only from creatures the player has necro'd before.
      this.shopOverlay.show(info.wave, this.capturedCreatures)
    }
  }

  /** A neglected corpse sank and left a shard — fly it out to the cosmos. */
  private handleCorpseShard(c: Corpse): void {
    const rect = this.board.getCellRect(c.cellIndex)
    const id = `soul-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const from = rect ? centerOf(rect) : this.cosmos.getAnchorPoint()
    this.blast.starFly(from, this.cosmos.pointFor(id), () => this.graveyardSystem.addShard(id, c.creatureId, c.label))
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

  /** Leaving the round-end lull: cascade the cosmos into whole cards, then
   * let the waves push again. */
  private resumeRun(): void {
    this.cascadeCosmos()
    this.waveSystem.resumeFromCheckpoint()
  }

  /** Death-return ladder — every fallen ally gives back 1/3 of its worth, one
   * step down: raised → shard, 1성 → fragment (both drift to the cosmos as
   * stars); 2성 → a 1성 card, 3성 → a 2성 card (flown straight back to hand). */
  private handleAllyDeath(e: AllyDeath): void {
    const rect = this.board.getCellRect(e.cellIndex)
    const from = rect ? centerOf(rect) : this.cosmos.getAnchorPoint()
    const tier = e.raised ? 0 : e.tier ?? 1

    if (tier <= 1) {
      const id = `soul-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const to = this.cosmos.pointFor(id)
      this.blast.starFly(from, to, () => {
        if (tier === 0) this.graveyardSystem.addShard(id, e.creatureId, e.label)
        else this.graveyardSystem.addFragment(id, e.creatureId, e.label)
      })
      return
    }

    // 2성/3성 return a card one tier down, straight to hand.
    const returnedTier = tier - 1
    const target = this.hand.getNextSlotPoint(this.handSystem.getCards().length + 1)
    this.blast.starFly(from, target, () =>
      this.handSystem.addCard({
        id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        label: e.label,
        creatureId: e.creatureId,
        tier: returnedTier === 1 ? undefined : returnedTier,
      })
    )
  }

  /** Round-end recovery: the cosmos cascades — 3 shards → fragment, 3 fragments
   * → a whole tier-1 card — and each produced card streaks into the hand. */
  private cascadeCosmos(): void {
    const cards = this.graveyardSystem.cascade()
    cards.forEach((card, i) => {
      window.setTimeout(() => {
        const from = this.cosmos.getAnchorPoint()
        const target = this.hand.getNextSlotPoint(this.handSystem.getCards().length + 1)
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
