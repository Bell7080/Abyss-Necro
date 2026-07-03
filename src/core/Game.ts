import { BoardRenderer } from '@ui/BoardRenderer'
import { CardHand } from '@ui/CardHand'
import { RelicInventory } from '@ui/RelicInventory'
import { BubbleBurst } from '@ui/effects/BubbleBurst'
import { HandSystem } from '@systems/HandSystem'
import { RelicSystem } from '@systems/RelicSystem'
import { WaveSystem } from '@systems/WaveSystem'

export class Game {
  private readonly handSystem = new HandSystem()
  private readonly relicSystem = new RelicSystem()
  private readonly waveSystem = new WaveSystem()
  private readonly board: BoardRenderer
  private readonly hand: CardHand
  private readonly relics: RelicInventory

  constructor(root: HTMLElement) {
    const shell = document.createElement('div')
    shell.className = 'abyss-shell'
    root.appendChild(shell)

    const boardMount = document.createElement('div')
    boardMount.className = 'board-mount'
    shell.appendChild(boardMount)

    this.relics = new RelicInventory(shell)
    this.hand = new CardHand(shell)
    this.board = new BoardRenderer(boardMount, this.waveSystem, (cellIndex, originRect) =>
      this.handleDefeat(cellIndex, originRect)
    )

    this.waveSystem.onChange(() => this.board.syncCells())
    this.handSystem.onChange((cards) => this.hand.render(cards))
    this.relicSystem.onChange((relics) => this.relics.render(relics))

    this.hand.render(this.handSystem.getCards())
    this.relics.render(this.relicSystem.getRelics())
  }

  boot(): void {
    this.board.render()
  }

  private handleDefeat(cellIndex: number, originRect: DOMRect): void {
    const result = this.waveSystem.defeat(cellIndex)

    if (result.dropCard) {
      const nextCount = this.handSystem.getCards().length + 1
      const target = this.hand.getNextSlotPoint(nextCount)
      const originX = originRect.left + originRect.width / 2
      const originY = originRect.top + originRect.height / 2

      BubbleBurst.travelTo(originX, originY, target.x, target.y, {
        onArrive: () =>
          this.handSystem.addCard({
            id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            label: '심연의 것',
          }),
      })
    }

    if (result.relicAwarded) {
      this.relicSystem.addRelic({
        id: `relic-${Date.now()}`,
        label: '이름 없는 유물',
      })
    }
  }
}
