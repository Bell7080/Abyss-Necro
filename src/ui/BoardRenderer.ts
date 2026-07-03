const GRID_COLUMNS = 5
const GRID_ROWS = 5

// Placeholder top-down grid so the render pipeline (Vite dev + Electron window)
// is verifiably working before the real wave/necromancy board replaces it.
export class BoardRenderer {
  constructor(private readonly root: HTMLElement) {}

  render(): void {
    this.root.innerHTML = ''

    const shell = document.createElement('div')
    shell.className = 'abyss-shell'

    const title = document.createElement('h1')
    title.className = 'abyss-title'
    title.textContent = 'Abyss Necro — prototype scaffold'
    shell.appendChild(title)

    const grid = document.createElement('div')
    grid.className = 'abyss-grid'
    grid.style.gridTemplateColumns = `repeat(${GRID_COLUMNS}, 1fr)`
    for (let i = 0; i < GRID_COLUMNS * GRID_ROWS; i += 1) {
      const cell = document.createElement('div')
      cell.className = 'abyss-cell'
      grid.appendChild(cell)
    }
    shell.appendChild(grid)

    this.root.appendChild(shell)
  }
}
