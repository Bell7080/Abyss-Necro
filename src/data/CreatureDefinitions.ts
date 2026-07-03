import jellyfishEnemyArt from '@/assets/sprites/enemies/en_001.webp'
import seaRabbitEnemyArt from '@/assets/sprites/enemies/en_002.webp'
import jellyfishAllyArt from '@/assets/sprites/allies/al_001.webp'
import seaRabbitAllyArt from '@/assets/sprites/allies/al_002.webp'

// First two of the eventual 40-creature roster. Each entry is the before
// (enemy) / after (necromanced ally) illustration pair the whole card
// loop revolves around — everything else (spawns, card drops, placed
// defenders) just carries this id around and looks the art back up here.
// `passive` is the creature's signature ability shown in the inspector;
// `passiveId` is the machine key the systems act on (jelly-amp aura, rabbit
// death-heal). Passives apply to the necromanced ally form the player
// deploys.
export type PassiveId = 'jelly-amp' | 'rabbit-heal'

export interface CreatureDefinition {
  id: string
  label: string
  enemyArt: string
  allyArt: string
  passive: string
  passiveId: PassiveId
}

export const CREATURES: CreatureDefinition[] = [
  {
    id: 'jellyfish',
    label: '해파리',
    enemyArt: jellyfishEnemyArt,
    allyArt: jellyfishAllyArt,
    passive: '감전 점막 — 이 칸에 있는 적이 받는 피해가 1 증가한다.',
    passiveId: 'jelly-amp',
  },
  {
    id: 'sea-rabbit',
    label: '바다토끼',
    enemyArt: seaRabbitEnemyArt,
    allyArt: seaRabbitAllyArt,
    passive: '폭신 도약 — 처치될 때 인접한 아군의 체력을 2 회복시킨다.',
    passiveId: 'rabbit-heal',
  },
]

export function randomCreature(): CreatureDefinition {
  return CREATURES[Math.floor(Math.random() * CREATURES.length)]
}

export function getCreature(id: string): CreatureDefinition | undefined {
  return CREATURES.find((c) => c.id === id)
}
