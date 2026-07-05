import type { WaveSystem } from '@systems/WaveSystem'
import type { DefenderSystem } from '@systems/DefenderSystem'
import { BOSS_CELL_INDEX } from '@systems/BoardConstants'
import { getCreature } from '@data/CreatureDefinitions'
import playerArt from '@/assets/sprites/player_001.webp'
import { Icons } from '@ui/Icons'
import { entityCardHtml } from '@ui/EntityCard'

const GRID_COLS = 4 // lane depth (matches WaveSystem COLS) — the wider horizontal axis
const GRID_ROWS = 3 // lanes — one horizontal row per lane (matches WaveSystem ROWS)
const CELL_COUNT = GRID_COLS * GRID_ROWS
// Must match .board-grid's grid-template-columns/rows/gap in board.css —
// tokens are positioned by pixel math instead of CSS grid placement so their
// movement between cells can transition smoothly. Cells shrank when the grid
// gained a 4th column so the wider board still fits the viewport.
const CELL_SIZE = 210
const CELL_GAP = 28
// Allies sit slightly left of a cell's center, enemies slightly right, so
// a shared cell reads as a face-off instead of a pile. Multiple occupants
// on the same side stack with a small vertical offset.
const GRID_ROLE_OFFSET_X = 62
const STACK_GAP_Y = 34
// In the boss/player cell: player leftmost (shifted well outside the cell,
// see --board-figure-shift-x), allies in the middle, enemies rightmost —
// the same "standing off against each other" composition.
const BOSS_ALLY_OFFSET_X = 120
const BOSS_ENEMY_OFFSET_X = 152

const DEFEAT_FX_MS = 420
const ENGAGE_FX_MS = 520
const ARRIVE_FX_MS = 340
const LUNGE_FX_MS = 280
// How far a token lunges toward its opponent on a clash, in px.
const LUNGE_DISTANCE = 44
// Must cover .board-token's 0.85s slide transition — a lunge starting
// inside that window would fight the in-flight transform.
const SLIDE_SETTLE_MS = 880
// .board-token's transform transition (0.85s) — used to interpolate where a
// dying enemy visually was so its corpse can pick up the remaining slide.
const CORPSE_SLIDE_MS = 850
// Matches the corpse-leave keyframe — keep the element alive long enough to play
// the fade/flicker/pop before pulling it from the DOM.
const CORPSE_LEAVE_MS = 880

interface Occupant {
  id: string
  hp: number
  maxHp: number
  label?: string
  creatureId?: string
  tier?: number
  raised?: boolean
  isBoss?: boolean
}

// Center board: left player/boss cell, flow arrow, 3x3 enemy grid on the
// right. The board tilts in 3D (see board.css --board-tilt); each cell's
// icon sits in a `.board-figure` wrapper that counter-rotates so tokens
// read as standing upright on a tilted floor.
//
// Enemy/ally tokens are NOT reparented between cells — each keeps one
// persistent `.board-token` div (keyed by entity id) absolutely positioned
// inside its cell's container (the grid, or the player cell for boss-room
// occupants), so moving is a `transform` change that CSS transitions into
// a walk/slide instead of a teleport. `.board-cell` itself stays a static
// floor-tile socket used for click targets and occupancy glow. The player
// cell can also host boss-room allies/enemies — reaching the player is no
// longer an instant resolution, it's a real fight happening in that cell.
export class BoardRenderer {
  private cellEls: HTMLElement[] = []
  private playerCellEl!: HTMLElement
  private playerFigureEl!: HTMLElement
  private playerHpFill: HTMLElement | null = null
  private playerHpText: HTMLElement | null = null
  private gridEl!: HTMLElement
  private readonly enemyTokens = new Map<string, HTMLElement>()
  private readonly allyTokens = new Map<string, HTMLElement>()
  private readonly bossEnemyTokens = new Map<string, HTMLElement>()
  private readonly bossAllyTokens = new Map<string, HTMLElement>()
  private readonly corpseTokens = new Map<string, HTMLElement>()

  constructor(
    private readonly root: HTMLElement,
    private readonly waveSystem: WaveSystem,
    private readonly defenderSystem: DefenderSystem,
    private readonly onCellClick: (cellIndex: number) => void,
    private readonly onCellHover: (cellIndex: number | null) => void = () => {},
    private readonly onCorpseClick: (corpseId: string) => void = () => {}
  ) {}

  render(): void {
    this.root.innerHTML = ''
    this.enemyTokens.clear()
    this.allyTokens.clear()
    this.bossEnemyTokens.clear()
    this.bossAllyTokens.clear()
    this.corpseTokens.clear()

    const layout = document.createElement('div')
    layout.className = 'board-layout'

    const playerButton = document.createElement('button')
    playerButton.type = 'button'
    this.playerCellEl = playerButton
    this.playerCellEl.className = 'board-player-cell'
    this.playerCellEl.addEventListener('click', () => this.onCellClick(BOSS_CELL_INDEX))
    this.playerCellEl.addEventListener('mouseenter', () => this.onCellHover(BOSS_CELL_INDEX))
    this.playerCellEl.addEventListener('mouseleave', () => this.onCellHover(null))
    const playerFigure = document.createElement('div')
    playerFigure.className = 'board-figure board-figure--boss-player'
    playerFigure.innerHTML = entityCardHtml({
      variant: 'player',
      imageUrl: playerArt,
      name: '넥슈',
      // Placeholder numbers — Game.boot() calls setPlayerHp() with the real
      // values right after render(), before this ever paints.
      hp: 1,
      maxHp: 1,
    })
    this.playerFigureEl = playerFigure
    this.playerHpFill = playerFigure.querySelector('.entity-card-hp-fill')
    this.playerHpText = playerFigure.querySelector('.entity-card-hp-text')
    this.playerCellEl.appendChild(playerFigure)
    layout.appendChild(this.playerCellEl)

    const arrow = document.createElement('div')
    arrow.className = 'board-flow-arrow'
    arrow.innerHTML = Icons.flowArrow()
    layout.appendChild(arrow)

    this.gridEl = document.createElement('div')
    this.gridEl.className = 'board-grid'
    // Constellation floor: the # of the grid drawn as faint starlight lines
    // with glowing stars at the crossings — appended first so cells and
    // tokens paint over it.
    const constellation = document.createElement('div')
    constellation.className = 'board-constellation'
    constellation.setAttribute('aria-hidden', 'true')
    constellation.innerHTML = constellationSvg()
    this.gridEl.appendChild(constellation)

    this.cellEls = []
    for (let i = 0; i < CELL_COUNT; i += 1) {
      const cell = document.createElement('button')
      cell.type = 'button'
      cell.className = 'board-cell'
      cell.addEventListener('click', () => this.onCellClick(i))
      cell.addEventListener('mouseenter', () => this.onCellHover(i))
      cell.addEventListener('mouseleave', () => this.onCellHover(null))
      this.gridEl.appendChild(cell)
      this.cellEls.push(cell)
    }
    layout.appendChild(this.gridEl)

    this.root.appendChild(layout)
    this.syncCells()
  }

  syncCells(): void {
    const enemyCells = this.waveSystem.getCells()
    const allyCells = this.defenderSystem.getCells()

    enemyCells.forEach((list, i) => this.cellEls[i]?.classList.toggle('has-enemy', list.length > 0))
    allyCells.forEach((list, i) => this.cellEls[i]?.classList.toggle('has-ally', list.length > 0))
    this.waveSystem.getCellTraps().forEach((count, i) => {
      const cell = this.cellEls[i]
      if (!cell) return
      cell.classList.toggle('has-trap', count > 0)
      cell.dataset.traps = count > 0 ? `${count}` : ''
      this.syncCellEffect(cell, i, count)
    })

    this.syncGridRole(this.enemyTokens, enemyCells, 'enemy')
    this.syncGridRole(this.allyTokens, allyCells, 'ally')
    this.syncBossRole(this.bossEnemyTokens, this.waveSystem.getBossEnemies(), 'enemy')
    this.syncBossRole(this.bossAllyTokens, this.defenderSystem.getBossAllies(), 'ally')
  }

  /** Faint raisable corpse markers, one per corpse, stacked per cell. Purely
   * positional — a dim purple-shadowed ghost of the creature's art. */
  syncCorpses(
    corpses: readonly {
      id: string
      creatureId: string
      cellIndex: number
      label: string
      fromCellIndex?: number
      movedAt?: number
    }[]
  ): void {
    const seen = new Set<string>()
    const stackCount = new Map<number, number>()
    for (const c of corpses) {
      seen.add(c.id)
      const stackIndex = stackCount.get(c.cellIndex) ?? 0
      stackCount.set(c.cellIndex, stackIndex + 1)

      const existing = this.corpseTokens.get(c.id)
      let el = existing
      if (!el) {
        el = document.createElement('div')
        el.className = 'board-token board-corpse'
        const creature = c.creatureId ? getCreature(c.creatureId) : undefined
        const img = creature?.allyArt ? `<img src="${creature.allyArt}" alt="" />` : ''
        el.innerHTML = `<div class="board-figure board-corpse-figure">${img}<div class="corpse-shadow" aria-hidden="true"></div></div>`
        // The figure (not the 210×210 token wrapper) is the clickable hit area —
        // a direct click raises THIS corpse instead of firing a basic attack.
        const figureEl = el.querySelector<HTMLElement>('.board-corpse-figure')
        figureEl?.addEventListener('click', (e) => {
          e.stopPropagation()
          this.onCorpseClick(c.id)
        })
        const container = c.cellIndex === BOSS_CELL_INDEX ? this.playerCellEl : this.gridEl
        container.appendChild(el)
        this.corpseTokens.set(c.id, el)
      }

      let x: number
      let y: number
      if (c.cellIndex === BOSS_CELL_INDEX) {
        x = BOSS_ENEMY_OFFSET_X
        y = stackIndex * STACK_GAP_Y
      } else {
        const row = Math.floor(c.cellIndex / GRID_COLS)
        const col = c.cellIndex % GRID_COLS
        x = col * (CELL_SIZE + CELL_GAP)
        y = row * (CELL_SIZE + CELL_GAP) + stackIndex * STACK_GAP_Y
      }

      // Just born from an enemy that was still sliding? Drop in at the enemy's
      // in-flight position and let the .board-token transition carry the corpse
      // the rest of the way — no teleport to the destination cell.
      if (!existing) this.seedCorpseSlide(el, c, x, y)
      el.style.setProperty('--token-x', `${x}px`)
      el.style.setProperty('--token-y', `${y}px`)
    }

    for (const [id, el] of this.corpseTokens) {
      if (!seen.has(id)) {
        // Rot-away exit: fade/flicker/pop, then pull it from the DOM.
        el.classList.add('is-leaving')
        window.setTimeout(() => el.remove(), CORPSE_LEAVE_MS)
        this.corpseTokens.delete(id)
      }
    }
  }

  /** Seeds a just-created corpse at the position its enemy had actually slid to
   * (interpolated along from→rest by how far the 0.85s slide had progressed),
   * committing it before the caller sets the resting position — so the token's
   * transform transition slides the corpse home instead of it teleporting. */
  private seedCorpseSlide(
    el: HTMLElement,
    c: { cellIndex: number; fromCellIndex?: number; movedAt?: number },
    restX: number,
    restY: number
  ): void {
    const { fromCellIndex, movedAt } = c
    if (fromCellIndex == null || movedAt == null) return
    if (fromCellIndex === c.cellIndex) return
    if (fromCellIndex === BOSS_CELL_INDEX || c.cellIndex === BOSS_CELL_INDEX) return
    const progress = Math.min(1, Math.max(0, (Date.now() - movedAt) / CORPSE_SLIDE_MS))
    if (progress >= 1) return // the enemy had already settled — nothing to carry

    const frow = Math.floor(fromCellIndex / GRID_COLS)
    const fcol = fromCellIndex % GRID_COLS
    const fromX = fcol * (CELL_SIZE + CELL_GAP)
    const fromY = frow * (CELL_SIZE + CELL_GAP)
    const startX = fromX + (restX - fromX) * progress
    const startY = fromY + (restY - fromY) * progress
    el.style.setProperty('--token-x', `${startX}px`)
    el.style.setProperty('--token-y', `${startY}px`)
    void el.offsetWidth // commit start pos so the following set transitions from here
  }

  // Persistent per-cell effects tint the tile with a slow shimmer; when two
  // are present (e.g. a trap-star + a jelly-amp aura) they layer into one
  // mixed wave. Trap = crimson, jelly-amp aura = cyan.
  private syncCellEffect(cell: HTMLElement, cellIndex: number, trapCount: number): void {
    const tints: string[] = []
    if (trapCount > 0) tints.push('rgba(255, 110, 135, 0.5)')
    if (this.defenderSystem.getDamageAmp(cellIndex) > 0) tints.push('rgba(120, 225, 255, 0.5)')

    cell.classList.toggle('has-effect', tints.length > 0)
    cell.style.setProperty('--cell-tint-a', tints[0] ?? 'transparent')
    cell.style.setProperty('--cell-tint-b', tints[1] ?? tints[0] ?? 'transparent')
  }

  private syncGridRole(
    tokens: Map<string, HTMLElement>,
    cellLists: readonly (readonly Occupant[])[],
    role: 'enemy' | 'ally'
  ): void {
    const seen = new Set<string>()
    const roleOffsetX = role === 'ally' ? -GRID_ROLE_OFFSET_X : GRID_ROLE_OFFSET_X

    cellLists.forEach((list, cellIndex) => {
      const row = Math.floor(cellIndex / GRID_COLS)
      const col = cellIndex % GRID_COLS
      const baseX = col * (CELL_SIZE + CELL_GAP) + roleOffsetX
      const baseY = row * (CELL_SIZE + CELL_GAP)

      list.forEach((occupant, i) => {
        seen.add(occupant.id)
        const y = baseY + (i - (list.length - 1) / 2) * STACK_GAP_Y
        // Freshly-spawned enemies walk in from a phantom column just past
        // the entry edge instead of popping into place on the grid.
        const spawnFromX = role === 'enemy' ? baseX + CELL_SIZE + CELL_GAP : undefined
        this.upsertToken(tokens, this.gridEl, occupant, role, baseX, y, spawnFromX)
      })
    })

    this.pruneTokens(tokens, seen)
  }

  private syncBossRole(
    tokens: Map<string, HTMLElement>,
    list: readonly Occupant[],
    role: 'enemy' | 'ally'
  ): void {
    const seen = new Set<string>()
    const x = role === 'ally' ? BOSS_ALLY_OFFSET_X : BOSS_ENEMY_OFFSET_X

    list.forEach((occupant, i) => {
      seen.add(occupant.id)
      const y = (i - (list.length - 1) / 2) * STACK_GAP_Y
      this.upsertToken(tokens, this.playerCellEl, occupant, role, x, y)
    })

    this.pruneTokens(tokens, seen)
  }

  private upsertToken(
    tokens: Map<string, HTMLElement>,
    container: HTMLElement,
    occupant: Occupant,
    variant: 'enemy' | 'ally',
    x: number,
    y: number,
    spawnFromX?: number
  ): void {
    const existing = tokens.get(occupant.id)
    if (existing) {
      // Stamp actual position changes so lunge fx can skip tokens whose
      // slide transition is still in flight (see playClashFx).
      const prevX = existing.style.getPropertyValue('--token-x')
      const prevY = existing.style.getPropertyValue('--token-y')
      if (prevX !== `${x}px` || prevY !== `${y}px`) {
        existing.dataset.movedAt = `${Date.now()}`
      }
      existing.style.setProperty('--token-x', `${x}px`)
      existing.style.setProperty('--token-y', `${y}px`)
      const fill = existing.querySelector<HTMLElement>('.entity-card-hp-fill')
      if (fill) fill.style.width = `${Math.round((occupant.hp / occupant.maxHp) * 100)}%`
      const hpText = existing.querySelector<HTMLElement>('.entity-card-hp-text')
      if (hpText) hpText.textContent = `${Math.max(0, Math.round(occupant.hp))}/${Math.round(occupant.maxHp)}`
      // Red hit-flash whenever this occupant's hp went down since last sync.
      const prevHp = Number(existing.dataset.hp ?? occupant.maxHp)
      if (occupant.hp < prevHp) flashCard(existing.querySelector('.entity-card'))
      existing.dataset.hp = `${occupant.hp}`
      return
    }

    const el = document.createElement('div')
    el.className = 'board-token'
    // Custom properties (not a direct transform) so the lunge keyframe can
    // layer an extra offset on top without fighting the slide transition.
    el.style.setProperty('--token-x', `${spawnFromX ?? x}px`)
    el.style.setProperty('--token-y', `${y}px`)
    el.dataset.hp = `${occupant.hp}`
    const creature = occupant.creatureId ? getCreature(occupant.creatureId) : undefined
    const imageUrl = creature ? (variant === 'ally' ? creature.allyArt : creature.enemyArt) : undefined
    const tierClass = occupant.tier === 3 ? ' is-tier3' : occupant.tier === 2 ? ' is-tier2' : ''
    const raisedClass = occupant.raised ? ' is-raised' : ''
    if (occupant.isBoss) el.classList.add('is-boss')
    el.innerHTML = `<div class="board-figure is-arrived${tierClass}${raisedClass}">${entityCardHtml({
      variant,
      art: Icons.enemyToken(),
      imageUrl,
      // Enemies show their creature name too — every card on the board is
      // labeled now, not just deployed allies.
      name: occupant.label ?? creature?.label,
      hpRatio: occupant.hp / occupant.maxHp,
      hp: occupant.hp,
      maxHp: occupant.maxHp,
      // Tier stars — deployed defenders only (hasty 급조 undead carry no rank).
      stars: variant === 'ally' && !occupant.raised ? (occupant.tier ?? 1) : undefined,
    })}</div>`
    container.appendChild(el)
    tokens.set(occupant.id, el)
    window.setTimeout(() => {
      el.querySelector('.board-figure')?.classList.remove('is-arrived')
    }, ARRIVE_FX_MS)

    if (spawnFromX !== undefined) {
      // Land on the phantom column first, then let the transition slide it
      // in to its real cell position on the next frame.
      el.dataset.movedAt = `${Date.now()}`
      requestAnimationFrame(() => {
        el.style.setProperty('--token-x', `${x}px`)
      })
    }
  }

  private pruneTokens(tokens: Map<string, HTMLElement>, seen: Set<string>): void {
    for (const [id, el] of tokens) {
      if (!seen.has(id)) {
        el.remove()
        tokens.delete(id)
      }
    }
  }

  /** Marks the given ally tokens as merge candidates — each pulses in its own
   * accent hue, mirroring the hand-card highlight for on-board (cell) merges. */
  setMergeCandidates(allyIds: readonly string[]): void {
    for (const el of [...this.allyTokens.values(), ...this.bossAllyTokens.values()]) {
      el.classList.remove('is-merge-candidate')
      el.style.removeProperty('--merge-hue')
    }
    allyIds.forEach((id, i) => {
      const el = this.allyTokens.get(id) ?? this.bossAllyTokens.get(id)
      if (!el) return
      el.classList.add('is-merge-candidate')
      el.style.setProperty('--merge-hue', `${(i * 118) % 360}`)
    })
  }

  /** Toggles the "pick a cell to deploy" affordance while a hand card is selected. */
  setPlacementTargeting(active: boolean): void {
    this.gridEl.classList.toggle('is-placement-targeting', active)
    this.playerCellEl.classList.toggle('is-placement-targetable', active)
  }

  /** 포획 aim: emphasis rides on the ENEMY, not the tile. Every enemy token
   * whose id is in the set gets a pulsing violet capture aura + a "넌 내꺼야!"
   * skull badge; all others are cleared. */
  setCaptureTargets(enemyIds: ReadonlySet<string>): void {
    const apply = (tokens: Map<string, HTMLElement>): void => {
      for (const [id, el] of tokens) {
        const on = enemyIds.has(id)
        el.classList.toggle('is-capture-target', on)
        // Marker rides on the raised standee (figure), floating above the card.
        const host = el.querySelector<HTMLElement>('.board-figure') ?? el
        let marker = host.querySelector<HTMLElement>('.capture-marker')
        if (on && !marker) {
          marker = document.createElement('div')
          marker.className = 'capture-marker'
          marker.innerHTML = Icons.captureSkull()
          host.appendChild(marker)
        } else if (!on && marker) {
          marker.remove()
        }
      }
    }
    apply(this.enemyTokens)
    apply(this.bossEnemyTokens)
  }

  /** 급조 aim: emphasis rides on the CORPSE itself, not the tile — every
   * raisable corpse (room permitting) gets a pulsing green aura + an up-chevron
   * badge, so the exact clickable target is unmistakable. */
  setRaiseTargets(corpseIds: ReadonlySet<string>): void {
    for (const [id, el] of this.corpseTokens) {
      const on = corpseIds.has(id)
      el.classList.toggle('is-raise-target', on)
      const host = el.querySelector<HTMLElement>('.board-corpse-figure') ?? el
      let marker = host.querySelector<HTMLElement>('.raise-marker')
      if (on && !marker) {
        marker = document.createElement('div')
        marker.className = 'raise-marker'
        marker.innerHTML = Icons.raiseHand()
        host.appendChild(marker)
      } else if (!on && marker) {
        marker.remove()
      }
    }
  }

  getCellRect(cellIndex: number): DOMRect | null {
    if (cellIndex === BOSS_CELL_INDEX) return this.getPlayerRect()
    return this.cellEls[cellIndex]?.getBoundingClientRect() ?? null
  }

  getPlayerRect(): DOMRect | null {
    return this.playerCellEl?.getBoundingClientRect() ?? null
  }

  /** The player's standee CARD rect (offset up/left of the floor socket) — the
   * true muzzle point, so casts launch from the card's center, not the tile. */
  getPlayerCardRect(): DOMRect | null {
    return this.playerFigureEl?.getBoundingClientRect() ?? null
  }

  /** Springy cast feedback on the player card: 'recoil' kicks it back-and-in
   * (ranged casts — 공격/포획), 'hop' bounces it up-and-down (raising casts —
   * 급조/기상). The keyframes carry the standee's own transform so the lean
   * and lift are preserved through the animation. */
  playerCast(kind: 'recoil' | 'hop'): void {
    const el = this.playerFigureEl
    if (!el) return
    const cls = kind === 'recoil' ? 'is-casting-recoil' : 'is-casting-hop'
    el.classList.remove('is-casting-recoil', 'is-casting-hop')
    void el.offsetWidth
    el.classList.add(cls)
    window.setTimeout(() => el.classList.remove(cls), 460)
  }

  playDefeatFx(cellIndex: number): void {
    const el = cellIndex === BOSS_CELL_INDEX ? this.playerCellEl : this.cellEls[cellIndex]
    if (!el) return
    el.classList.add('is-defeated')
    window.setTimeout(() => el.classList.remove('is-defeated'), DEFEAT_FX_MS)
  }

  pulseBossRoom(): void {
    this.playerCellEl.classList.add('is-engaged')
    window.setTimeout(() => this.playerCellEl.classList.remove('is-engaged'), ENGAGE_FX_MS)
  }

  /** Live player HP on the necromancer card's bottom bar. */
  setPlayerHp(hp: number, maxHp: number): void {
    if (this.playerHpFill) this.playerHpFill.style.width = `${Math.round((hp / maxHp) * 100)}%`
    if (this.playerHpText) this.playerHpText.textContent = `${Math.max(0, Math.round(hp))}/${Math.round(maxHp)}`
  }

  /** Red hit-flash on the necromancer card (enemy struck the player). */
  flashPlayerHit(): void {
    flashCard(this.playerCellEl.querySelector('.entity-card'))
  }

  /** Front-of-queue enemy/ally briefly lunge at each other for a clash tick.
   * Ally sits left of enemy in both the grid (role offset) and the boss
   * room (BOSS_ALLY_OFFSET_X < BOSS_ENEMY_OFFSET_X), so the lunge direction
   * is the same in either case: ally lunges right, enemy lunges left. */
  playClashFx(cellIndex: number): void {
    const isBossRoom = cellIndex === BOSS_CELL_INDEX
    const enemy = isBossRoom ? this.waveSystem.getBossEnemies()[0] : this.waveSystem.getCells()[cellIndex]?.[0]
    const ally = isBossRoom
      ? this.defenderSystem.getBossAllies()[0]
      : this.defenderSystem.getCells()[cellIndex]?.[0]
    const enemyTokenMap = isBossRoom ? this.bossEnemyTokens : this.enemyTokens
    const allyTokenMap = isBossRoom ? this.bossAllyTokens : this.allyTokens

    if (enemy) this.lungeToken(enemyTokenMap.get(enemy.id), -LUNGE_DISTANCE)
    if (ally) this.lungeToken(allyTokenMap.get(ally.id), LUNGE_DISTANCE)
  }

  private lungeToken(el: HTMLElement | undefined, distance: number): void {
    if (!el) return
    // A token whose slide transition is still in flight would visually
    // teleport to its destination for the lunge keyframe, then appear to
    // retreat when the keyframe releases — skip the lunge (the damage/burst
    // still land), it re-engages next tick from a settled position.
    const movedAt = Number(el.dataset.movedAt ?? 0)
    if (Date.now() - movedAt < SLIDE_SETTLE_MS) return
    el.style.setProperty('--token-lunge-x', `${distance}px`)
    el.classList.add('is-lunging')
    window.setTimeout(() => el.classList.remove('is-lunging'), LUNGE_FX_MS)
  }
}

const HIT_FLASH_MS = 260

/** Quick red blink on an entity card that just took damage. */
function flashCard(card: Element | null): void {
  if (!card) return
  card.classList.remove('is-hit')
  // Force a reflow so back-to-back hits restart the animation.
  void (card as HTMLElement).offsetWidth
  card.classList.add('is-hit')
  window.setTimeout(() => card.classList.remove('is-hit'), HIT_FLASH_MS)
}

// Four-point star for the constellation crossings — a crisp diamond core with
// short sparkle points (higher `w` = fuller, more gem-like than a thin cross).
function starPath(cx: number, cy: number, r: number): string {
  const w = r * 0.42
  return `M${cx} ${cy - r} L${cx + w} ${cy - w} L${cx + r} ${cy} L${cx + w} ${cy + w} L${cx} ${cy + r} L${cx - w} ${cy + w} L${cx - r} ${cy} L${cx - w} ${cy - w} Z`
}

/** The grid's inner boundaries drawn as a "#" constellation: a starlight line
 * through each internal column/row gap, big stars where lines cross, small
 * ones where lines meet the grid edge. Generalized over GRID_COLS×GRID_ROWS. */
function constellationSvg(): string {
  const width = GRID_COLS * CELL_SIZE + (GRID_COLS - 1) * CELL_GAP
  const height = GRID_ROWS * CELL_SIZE + (GRID_ROWS - 1) * CELL_GAP
  // Internal gap centers — vertical lines sit at column gaps, horizontal at row gaps.
  const gapAt = (i: number): number => i * (CELL_SIZE + CELL_GAP) - CELL_GAP / 2
  const xs = Array.from({ length: GRID_COLS - 1 }, (_, i) => gapAt(i + 1))
  const ys = Array.from({ length: GRID_ROWS - 1 }, (_, i) => gapAt(i + 1))

  const lines = [
    ...xs.map((x) => `M${x} 0 L${x} ${height}`),
    ...ys.map((y) => `M0 ${y} L${width} ${y}`),
  ]
  const crossings: Array<[number, number]> = []
  for (const x of xs) for (const y of ys) crossings.push([x, y])
  const edges: Array<[number, number]> = [
    ...xs.flatMap((x): Array<[number, number]> => [[x, 0], [x, height]]),
    ...ys.flatMap((y): Array<[number, number]> => [[0, y], [width, y]]),
  ]

  const linesHtml = lines.map((d) => `<path class="board-constellation-line" d="${d}"/>`).join('')
  const bigStars = crossings
    .map(([x, y], i) => `<path class="board-star board-star--big board-star--p${i % 4}" d="${starPath(x, y, 11)}"/>`)
    .join('')
  const smallStars = edges
    .map(([x, y], i) => `<path class="board-star board-star--p${i % 4}" d="${starPath(x, y, 5.5)}"/>`)
    .join('')

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${linesHtml}${bigStars}${smallStars}</svg>`
}
