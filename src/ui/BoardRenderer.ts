import type { WaveSystem } from '@systems/WaveSystem'
import type { DefenderSystem } from '@systems/DefenderSystem'
import { BOSS_CELL_INDEX } from '@systems/BoardConstants'
import { Icons } from '@ui/Icons'
import { entityCardHtml } from '@ui/EntityCard'

const CELL_COUNT = 9
const GRID_COLS = 3
// Must match .board-grid's grid-template-columns/gap in board.css — tokens
// are positioned by pixel math instead of CSS grid placement so their
// movement between cells can transition smoothly.
const CELL_SIZE = 140
const CELL_GAP = 16
// Allies sit slightly left of a cell's center, enemies slightly right, so
// a shared cell reads as a face-off instead of a pile. Multiple occupants
// on the same side stack with a small vertical offset.
const GRID_ROLE_OFFSET_X = 40
const STACK_GAP_Y = 20
// In the boss/player cell: player leftmost, allies in the middle, enemies
// rightmost — the same "standing off against each other" composition.
const BOSS_ALLY_OFFSET_X = 0
const BOSS_ENEMY_OFFSET_X = 52

const DEFEAT_FX_MS = 420
const ENGAGE_FX_MS = 520
const ARRIVE_FX_MS = 340
const LUNGE_FX_MS = 280
// How far a token lunges toward its opponent on a clash, in px.
const LUNGE_DISTANCE = 22

interface Occupant {
  id: string
  hp: number
  maxHp: number
  label?: string
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
  private gridEl!: HTMLElement
  private readonly enemyTokens = new Map<string, HTMLElement>()
  private readonly allyTokens = new Map<string, HTMLElement>()
  private readonly bossEnemyTokens = new Map<string, HTMLElement>()
  private readonly bossAllyTokens = new Map<string, HTMLElement>()

  constructor(
    private readonly root: HTMLElement,
    private readonly waveSystem: WaveSystem,
    private readonly defenderSystem: DefenderSystem,
    private readonly onCellClick: (cellIndex: number) => void
  ) {}

  render(): void {
    this.root.innerHTML = ''
    this.enemyTokens.clear()
    this.allyTokens.clear()
    this.bossEnemyTokens.clear()
    this.bossAllyTokens.clear()

    const layout = document.createElement('div')
    layout.className = 'board-layout'

    const playerButton = document.createElement('button')
    playerButton.type = 'button'
    this.playerCellEl = playerButton
    this.playerCellEl.className = 'board-player-cell'
    this.playerCellEl.addEventListener('click', () => this.onCellClick(BOSS_CELL_INDEX))
    const playerFigure = document.createElement('div')
    playerFigure.className = 'board-figure board-figure--boss-player'
    playerFigure.innerHTML = entityCardHtml({
      variant: 'player',
      art: Icons.skullCrown(),
      name: '네크로맨서',
    })
    this.playerCellEl.appendChild(playerFigure)
    layout.appendChild(this.playerCellEl)

    const arrow = document.createElement('div')
    arrow.className = 'board-flow-arrow'
    arrow.innerHTML = Icons.flowArrow()
    layout.appendChild(arrow)

    this.gridEl = document.createElement('div')
    this.gridEl.className = 'board-grid'
    this.cellEls = []
    for (let i = 0; i < CELL_COUNT; i += 1) {
      const cell = document.createElement('button')
      cell.type = 'button'
      cell.className = 'board-cell'
      cell.addEventListener('click', () => this.onCellClick(i))
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

    this.syncGridRole(this.enemyTokens, enemyCells, 'enemy')
    this.syncGridRole(this.allyTokens, allyCells, 'ally')
    this.syncBossRole(this.bossEnemyTokens, this.waveSystem.getBossEnemies(), 'enemy')
    this.syncBossRole(this.bossAllyTokens, this.defenderSystem.getBossAllies(), 'ally')
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
      existing.style.setProperty('--token-x', `${x}px`)
      existing.style.setProperty('--token-y', `${y}px`)
      const fill = existing.querySelector<HTMLElement>('.entity-card-hp-fill')
      if (fill) fill.style.width = `${Math.round((occupant.hp / occupant.maxHp) * 100)}%`
      return
    }

    const el = document.createElement('div')
    el.className = 'board-token'
    // Custom properties (not a direct transform) so the lunge keyframe can
    // layer an extra offset on top without fighting the slide transition.
    el.style.setProperty('--token-x', `${spawnFromX ?? x}px`)
    el.style.setProperty('--token-y', `${y}px`)
    el.innerHTML = `<div class="board-figure is-arrived">${entityCardHtml({
      variant,
      art: Icons.enemyToken(),
      name: occupant.label,
      hpRatio: occupant.hp / occupant.maxHp,
    })}</div>`
    container.appendChild(el)
    tokens.set(occupant.id, el)
    window.setTimeout(() => {
      el.querySelector('.board-figure')?.classList.remove('is-arrived')
    }, ARRIVE_FX_MS)

    if (spawnFromX !== undefined) {
      // Land on the phantom column first, then let the transition slide it
      // in to its real cell position on the next frame.
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

  /** Toggles the "pick a cell to deploy" affordance while a hand card is selected. */
  setPlacementTargeting(active: boolean): void {
    this.gridEl.classList.toggle('is-placement-targeting', active)
    this.playerCellEl.classList.toggle('is-placement-targetable', active)
  }

  getCellRect(cellIndex: number): DOMRect | null {
    if (cellIndex === BOSS_CELL_INDEX) return this.getPlayerRect()
    return this.cellEls[cellIndex]?.getBoundingClientRect() ?? null
  }

  getPlayerRect(): DOMRect | null {
    return this.playerCellEl?.getBoundingClientRect() ?? null
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
    el.style.setProperty('--token-lunge-x', `${distance}px`)
    el.classList.add('is-lunging')
    window.setTimeout(() => el.classList.remove('is-lunging'), LUNGE_FX_MS)
  }
}
