// Usable item cards — the second half of the 50/50 kill-drop split. They
// sit in the hand like necro cards but are consumed on use instead of
// placing a defender. Effects resolve in Game (systems do the mutation).
export interface ItemCardDefinition {
  id: string
  label: string
  desc: string
  /** true = the clicked cell matters (heal that cell); false = board-wide. */
  targeted: boolean
}

export const ITEM_CARDS: ItemCardDefinition[] = [
  {
    id: 'abyss-pulse',
    label: '심연 파동',
    desc: '필드의 모든 적에게 1의 피해를 준다.',
    targeted: false,
  },
  {
    id: 'healing-bubble',
    label: '치유 물결',
    desc: '선택한 칸의 아군을 3 회복시킨다.',
    targeted: true,
  },
]

export function randomItemCard(): ItemCardDefinition {
  return ITEM_CARDS[Math.floor(Math.random() * ITEM_CARDS.length)]
}

export function getItemCard(id: string): ItemCardDefinition | undefined {
  return ITEM_CARDS.find((card) => card.id === id)
}
