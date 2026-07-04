import jellyfishEnemyArt from '@/assets/sprites/enemies/en_001.webp'
import seaRabbitEnemyArt from '@/assets/sprites/enemies/en_002.webp'
import crabEnemyArt from '@/assets/sprites/enemies/en_003.webp'
import jellyfishAllyArt from '@/assets/sprites/allies/al_001.webp'
import seaRabbitAllyArt from '@/assets/sprites/allies/al_002.webp'
import crabAllyArt from '@/assets/sprites/allies/al_003.webp'

// First two of the eventual 40-creature roster. Each entry is the before
// (enemy) / after (necromanced ally) illustration pair the whole card
// loop revolves around — everything else (spawns, card drops, placed
// defenders) just carries this id around and looks the art back up here.
// `passive` is the creature's signature ability shown in the inspector;
// `passiveId` is the machine key the systems act on (jelly-amp aura, rabbit
// death-heal). Passives apply to the necromanced ally form the player
// deploys.
export type PassiveId = 'jelly-amp' | 'rabbit-heal' | 'crab-guard'

export interface CreatureDefinition {
  id: string
  label: string
  enemyArt: string
  allyArt: string
  /** Flavor shown in the codex "before" (enemy) column. */
  enemyDesc: string
  passive: string
  passiveId: PassiveId
}

export const CREATURES: CreatureDefinition[] = [
  {
    id: 'jellyfish',
    label: '해파리',
    enemyArt: jellyfishEnemyArt,
    allyArt: jellyfishAllyArt,
    enemyDesc: '심연을 부유하는 반투명 포식자. 스치는 촉수마다 저릿한 냉기를 흘린다.',
    passive: '감전 점막 — 이 칸에 있는 적이 받는 피해가 1 증가한다.',
    passiveId: 'jelly-amp',
  },
  {
    id: 'sea-rabbit',
    label: '바다토끼',
    enemyArt: seaRabbitEnemyArt,
    allyArt: seaRabbitAllyArt,
    enemyDesc: '심해를 폴짝이며 무리 짓는 연약한 생물. 방심하면 순식간에 불어난다.',
    passive: '폭신 도약 — 처치될 때 인접한 아군의 체력을 2 회복시킨다.',
    passiveId: 'rabbit-heal',
  },
  {
    id: 'crab',
    label: '꽃게',
    enemyArt: crabEnemyArt,
    allyArt: crabAllyArt,
    enemyDesc: '두꺼운 등껍질로 몸을 감싼 심연의 파수꾼. 좀처럼 무너지지 않는다.',
    passive: '단단한 등껍질 — 두꺼운 껍질로 더 많은 체력(11)을 지니고 배치된다.',
    passiveId: 'crab-guard',
  },
]

export function randomCreature(): CreatureDefinition {
  return CREATURES[Math.floor(Math.random() * CREATURES.length)]
}

export function getCreature(id: string): CreatureDefinition | undefined {
  return CREATURES.find((c) => c.id === id)
}
