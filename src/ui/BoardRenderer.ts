import type { WaveSystem } from '@systems/WaveSystem'
import { Icons } from '@ui/Icons'

const CELL_COUNT = 9

// Center board: left player/boss cell, flow arrow, 3x3 enemy grid on the
// right. Layout only — WaveSystem owns which cells hold an enemy.
export class BoardRenderer {
  private cellEls: HTMLElement[] = []

  constructor(
    private readonly root: HTMLElement,
    private readonly waveSystem: WaveSystem,
    private readonly onDefeat: (cellIndex: number, originRect: DOMRect) => void
  ) {}

  render(): void {
    this.root.innerHTML = ''
    const layout = document.createElement('div')
    layout.className = 'board-layout'

    const playerCell = document.createElement('div')
    playerCell.className = 'board-player-cell'
    playerCell.innerHTML = `${Icons.skullCrown()}<span class="board-player-label">네크로맨서</span>`
    layout.appendChild(playerCell)

    const arrow = document.createElement('div')
    arrow.className = 'board-flow-arrow'
    arrow.innerHTML = Icons.flowArrow()
    layout.appendChild(arrow)

    const grid = document.createElement('div')
    grid.className = 'board-grid'
    this.cellEls = []
    for (let i = 0; i < CELL_COUNT; i += 1) {
      const cell = document.createElement('button')
      cell.type = 'button'
      cell.className = 'board-cell'
      cell.addEventListener('click', () => this.handleCellClick(i))
      grid.appendChild(cell)
      this.cellEls.push(cell)
    }
    layout.appendChild(grid)

    this.root.appendChild(layout)
    this.syncCells()
  }

  syncCells(): void {
    const cells = this.waveSystem.getCells()
    cells.forEach((enemy, i) => {
      const el = this.cellEls[i]
      if (!el) return
      el.classList.toggle('has-enemy', !!enemy)
      el.classList.remove('is-defeated')
      el.innerHTML = enemy ? Icons.enemyToken() : ''
    })
  }

  private handleCellClick(i: number): void {
    const enemy = this.waveSystem.getCells()[i]
    if (!enemy) return
    const rect = this.cellEls[i].getBoundingClientRect()
    this.cellEls[i].classList.add('is-defeated')
    this.onDefeat(i, rect)
  }
}
