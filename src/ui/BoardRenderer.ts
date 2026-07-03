import type { WaveSystem } from '@systems/WaveSystem'
import { Icons } from '@ui/Icons'

const CELL_COUNT = 9
const DEFEAT_FX_MS = 420
const ENGAGE_FX_MS = 520
const ARRIVE_FX_MS = 340

// Center board: left player/boss cell, flow arrow, 3x3 enemy grid on the
// right. The board tilts in 3D (see board.css --board-tilt); each cell's
// icon sits in a `.board-figure` wrapper that counter-rotates so tokens
// read as standing upright on a tilted floor. Layout + fx only — WaveSystem
// owns enemy position/movement state, Game.ts decides what a cell click
// means (only meaningful while an attack is armed).
export class BoardRenderer {
  private cellEls: HTMLElement[] = []
  private playerCellEl!: HTMLElement
  private gridEl!: HTMLElement
  private previousOccupied: boolean[] = new Array(CELL_COUNT).fill(false)

  constructor(
    private readonly root: HTMLElement,
    private readonly waveSystem: WaveSystem,
    private readonly onCellClick: (cellIndex: number) => void
  ) {}

  render(): void {
    this.root.innerHTML = ''
    const layout = document.createElement('div')
    layout.className = 'board-layout'

    this.playerCellEl = document.createElement('div')
    this.playerCellEl.className = 'board-player-cell'
    this.playerCellEl.innerHTML = `<div class="board-figure">${Icons.skullCrown()}<span class="board-player-label">네크로맨서</span></div>`
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
    this.previousOccupied = new Array(CELL_COUNT).fill(false)
    this.syncCells()
  }

  syncCells(): void {
    const cells = this.waveSystem.getCells()
    cells.forEach((enemy, i) => {
      const el = this.cellEls[i]
      if (!el) return
      const occupied = !!enemy
      el.classList.toggle('has-enemy', occupied)
      el.innerHTML = occupied ? `<div class="board-figure is-arrived">${Icons.enemyToken()}</div>` : ''
      if (occupied && !this.previousOccupied[i]) {
        window.setTimeout(() => {
          el.querySelector('.board-figure')?.classList.remove('is-arrived')
        }, ARRIVE_FX_MS)
      }
      this.previousOccupied[i] = occupied
    })
  }

  /** Toggles the "pick a target" affordance while basic attack is armed. */
  setTargeting(active: boolean): void {
    this.gridEl.classList.toggle('is-targeting', active)
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
