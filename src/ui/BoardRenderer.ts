import type { WaveSystem } from '@systems/WaveSystem'
import type { DefenderSystem } from '@systems/DefenderSystem'
import { Icons } from '@ui/Icons'
import { entityCardHtml } from '@ui/EntityCard'

const CELL_COUNT = 9
const GRID_COLS = 3
// Must match .board-grid's grid-template-columns/gap in board.css — tokens
// are positioned by pixel math instead of CSS grid placement so their
// movement between cells can transition smoothly.
const CELL_SIZE = 140
const CELL_GAP = 16

const DEFEAT_FX_MS = 420
const ENGAGE_FX_MS = 520
const ARRIVE_FX_MS = 340

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
// Enemy/ally tokens are NOT reparented between `.board-cell` elements —
// each keeps one persistent `.board-token` div (keyed by entity id)
// absolutely positioned inside `.board-grid`, so moving to a new cell is a
// `transform` change that CSS transitions into a walk/slide instead of a
// teleport. `.board-cell` itself stays a static floor-tile socket used for
// click targets and occupancy glow.
export class BoardRenderer {
  private cellEls: HTMLElement[] = []
  private playerCellEl!: HTMLElement
  private gridEl!: HTMLElement
  private readonly enemyTokens = new Map<string, HTMLElement>()
  private readonly allyTokens = new Map<string, HTMLElement>()

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
    const layout = document.createElement('div')
    layout.className = 'board-layout'

    this.playerCellEl = document.createElement('div')
    this.playerCellEl.className = 'board-player-cell'
    this.playerCellEl.innerHTML = `<div class="board-figure">${entityCardHtml({
      variant: 'player',
      art: Icons.skullCrown(),
      name: '네크로맨서',
    })}</div>`
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

    enemyCells.forEach((enemy, i) => this.cellEls[i]?.classList.toggle('has-enemy', !!enemy))
    allyCells.forEach((ally, i) => this.cellEls[i]?.classList.toggle('has-ally', !!ally))

    this.syncTokens(this.enemyTokens, enemyCells, 'enemy')
    this.syncTokens(this.allyTokens, allyCells, 'ally')
  }

  private syncTokens(
    tokens: Map<string, HTMLElement>,
    occupants: readonly (Occupant | null)[],
    variant: 'enemy' | 'ally'
  ): void {
    const seen = new Set<string>()

    occupants.forEach((occupant, index) => {
      if (!occupant) return
      seen.add(occupant.id)

      const row = Math.floor(index / GRID_COLS)
      const col = index % GRID_COLS
      const x = col * (CELL_SIZE + CELL_GAP)
      const y = row * (CELL_SIZE + CELL_GAP)

      const existing = tokens.get(occupant.id)
      if (existing) {
        existing.style.transform = `translate(${x}px, ${y}px)`
        const fill = existing.querySelector<HTMLElement>('.entity-card-hp-fill')
        if (fill) fill.style.width = `${Math.round((occupant.hp / occupant.maxHp) * 100)}%`
        return
      }

      const el = document.createElement('div')
      el.className = 'board-token'
      el.style.transform = `translate(${x}px, ${y}px)`
      el.innerHTML = `<div class="board-figure is-arrived">${entityCardHtml({
        variant,
        art: Icons.enemyToken(),
        name: occupant.label,
        hpRatio: occupant.hp / occupant.maxHp,
      })}</div>`
      this.gridEl.appendChild(el)
      tokens.set(occupant.id, el)
      window.setTimeout(() => {
        el.querySelector('.board-figure')?.classList.remove('is-arrived')
      }, ARRIVE_FX_MS)
    })

    for (const [id, el] of tokens) {
      if (!seen.has(id)) {
        el.remove()
        tokens.delete(id)
      }
    }
  }

  /** Toggles the "pick a target" affordance while basic attack is armed. */
  setTargeting(active: boolean): void {
    this.gridEl.classList.toggle('is-targeting', active)
  }

  /** Toggles the "pick a cell to deploy" affordance while a hand card is selected. */
  setPlacementTargeting(active: boolean): void {
    this.gridEl.classList.toggle('is-placement-targeting', active)
  }

  getCellRect(cellIndex: number): DOMRect | null {
    return this.cellEls[cellIndex]?.getBoundingClientRect() ?? null
  }

  getPlayerRect(): DOMRect | null {
    return this.playerCellEl?.getBoundingClientRect() ?? null
  }

  playDefeatFx(cellIndex: number): void {
    const el = this.cellEls[cellIndex]
    if (!el) return
    el.classList.add('is-defeated')
    window.setTimeout(() => el.classList.remove('is-defeated'), DEFEAT_FX_MS)
  }

  pulseBossRoom(): void {
    this.playerCellEl.classList.add('is-engaged')
    window.setTimeout(() => this.playerCellEl.classList.remove('is-engaged'), ENGAGE_FX_MS)
  }
}
