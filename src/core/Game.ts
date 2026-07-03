import { BoardRenderer } from '@ui/BoardRenderer'

// Bootstrap stub — proves the Vite + Electron pipeline renders before real
// wave/necromancy systems land. Replace with the real game loop incrementally.
export class Game {
  private readonly board: BoardRenderer

  constructor(root: HTMLElement) {
    this.board = new BoardRenderer(root)
  }

  boot(): void {
    this.board.render()
  }
}
