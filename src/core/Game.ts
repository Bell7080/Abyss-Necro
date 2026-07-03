import { BoardRenderer } from '@ui/BoardRenderer'
import { CardHand } from '@ui/CardHand'
import { RelicInventory } from '@ui/RelicInventory'
import { SkillBar } from '@ui/SkillBar'
import { BubbleBurst } from '@ui/effects/BubbleBurst'
import { CurseMortar } from '@ui/effects/CurseMortar'
import { showDamageNumber } from '@ui/effects/FloatingDamage'
import { AbilitySystem } from '@systems/AbilitySystem'
import { HandSystem } from '@systems/HandSystem'
import { RelicSystem } from '@systems/RelicSystem'
import { WaveSystem, type EncounterResult } from '@systems/WaveSystem'

const BASIC_ATTACK_DAMAGE = 2
const ULTIMATE_DAMAGE = 4

export class Game {
  private readonly handSystem = new HandSystem()
  private readonly relicSystem = new RelicSystem()
  private readonly waveSystem = new WaveSystem()
  private readonly abilitySystem = new AbilitySystem()
  private readonly board: BoardRenderer
  private readonly hand: CardHand
  private readonly relics: RelicInventory
  private readonly skillBar: SkillBar

  constructor(root: HTMLElement) {
    const shell = document.createElement('div')
    shell.className = 'abyss-shell'
    root.appendChild(shell)

    const boardMount = document.createElement('div')
    boardMount.className = 'board-mount'
    shell.appendChild(boardMount)

    this.relics = new RelicInventory(shell)
    this.hand = new CardHand(shell)
    this.board = new BoardRenderer(boardMount, this.waveSystem, (cellIndex) =>
      this.handleCellClick(cellIndex)
    )
    this.skillBar = new SkillBar(shell, this.abilitySystem, {
      onBasicClick: () => this.abilitySystem.toggleArmBasic(),
      onUltimateClick: () => this.castUltimate(),
    })

    this.waveSystem.onChange(() => this.board.syncCells())
    this.waveSystem.onEncounter((result) => this.handleEncounter(result))
    this.handSystem.onChange((cards) => this.hand.render(cards))
    this.relicSystem.onChange((relics) => this.relics.render(relics))
    this.abilitySystem.onChange(() => {
      this.skillBar.render()
      this.board.setTargeting(this.abilitySystem.isBasicArmed())
    })

    this.hand.render(this.handSystem.getCards())
    this.relics.render(this.relicSystem.getRelics())
    this.skillBar.render()
  }

  boot(): void {
    this.board.render()
  }

  private handleCellClick(cellIndex: number): void {
    if (!this.abilitySystem.isBasicArmed()) return
    if (!this.abilitySystem.tryCastBasic()) return
    this.castBasicAttack(cellIndex)
  }

  private castBasicAttack(cellIndex: number): void {
    const originRect = this.board.getPlayerRect()
    const targetRect = this.board.getCellRect(cellIndex)
    if (!originRect || !targetRect) return

    const origin = centerOf(originRect)
    const target = centerOf(targetRect)

    CurseMortar.fire(origin.x, origin.y, target.x, target.y, {
      onImpact: () => {
        const result = this.waveSystem.applyDamage(cellIndex, BASIC_ATTACK_DAMAGE)
        if (result) showDamageNumber(target.x, target.y, result.amount)
      },
    })
  }

  private castUltimate(): void {
    if (!this.abilitySystem.tryCastUltimate()) return
    const originRect = this.board.getPlayerRect()
    if (!originRect) return
    const origin = centerOf(originRect)

    for (const cellIndex of this.waveSystem.getAliveCellIndices()) {
      const targetRect = this.board.getCellRect(cellIndex)
      if (!targetRect) continue
      const target = centerOf(targetRect)

      CurseMortar.fire(origin.x, origin.y, target.x, target.y, {
        delay: Math.random() * 140,
        onImpact: () => {
          const result = this.waveSystem.applyDamage(cellIndex, ULTIMATE_DAMAGE)
          if (result) showDamageNumber(target.x, target.y, result.amount)
        },
      })
    }
  }

  private handleEncounter(result: EncounterResult): void {
    const rect = this.board.getCellRect(result.cellIndex)
    this.board.playDefeatFx(result.cellIndex)
    if (result.viaBossRoom) this.board.pulseBossRoom()

    if (result.dropCard && rect) {
      const nextCount = this.handSystem.getCards().length + 1
      const target = this.hand.getNextSlotPoint(nextCount)
      const origin = centerOf(rect)

      BubbleBurst.travelTo(origin.x, origin.y, target.x, target.y, {
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

function centerOf(rect: DOMRect): { x: number; y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}
