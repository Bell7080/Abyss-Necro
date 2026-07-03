// Epic facility cards — rare kill drops and checkpoint-shop stock. 'cell'
// cards place a permanent effect on a grid cell; 'global' cards apply a
// permanent, stackable buff the moment they're used on any cell. Effects
// resolve in Game against the owning systems.
export interface EpicCardDefinition {
  id: string
  label: string
  desc: string
  kind: 'cell' | 'global'
}

export const EPIC_CARDS: EpicCardDefinition[] = [
  {
    id: 'trap-star',
    label: '함정별',
    desc: '선택한 칸에 함정별을 심는다. 그 칸에 들어오는 적이 1의 피해를 받는다. 중첩 가능.',
    kind: 'cell',
  },
  {
    id: 'power-star',
    label: '증가별',
    desc: '배치된 아군 전체의 공격력이 영구히 1 증가한다. 중첩 가능.',
    kind: 'global',
  },
  {
    id: 'vitality-star',
    label: '심연의 심장',
    desc: '넥슈의 최대 체력이 2 증가하고 그만큼 회복한다.',
    kind: 'global',
  },
  {
    id: 'sharpen-star',
    label: '벼려진 저주',
    desc: '기본 공격의 피해가 영구히 1 증가한다.',
    kind: 'global',
  },
  {
    id: 'overload-star',
    label: '과부하 문양',
    desc: '강화 공격(스킬)의 피해가 영구히 2 증가한다.',
    kind: 'global',
  },
]

export function randomEpicCard(): EpicCardDefinition {
  return EPIC_CARDS[Math.floor(Math.random() * EPIC_CARDS.length)]
}

export function getEpicCard(id: string): EpicCardDefinition | undefined {
  return EPIC_CARDS.find((card) => card.id === id)
}
