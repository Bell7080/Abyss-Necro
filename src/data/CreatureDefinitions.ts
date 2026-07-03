import jellyfishEnemyArt from '@/assets/sprites/enemies/en_001.webp'
import seaRabbitEnemyArt from '@/assets/sprites/enemies/en_002.webp'
import jellyfishAllyArt from '@/assets/sprites/allies/al_001.webp'
import seaRabbitAllyArt from '@/assets/sprites/allies/al_002.webp'

// First two of the eventual 40-creature roster. Each entry is the before
// (enemy) / after (necromanced ally) illustration pair the whole card
// loop revolves around — everything else (spawns, card drops, placed
// defenders) just carries this id around and looks the art back up here.
export interface CreatureDefinition {
  id: string
  label: string
  enemyArt: string
  allyArt: string
}

export const CREATURES: CreatureDefinition[] = [
  { id: 'jellyfish', label: '해파리', enemyArt: jellyfishEnemyArt, allyArt: jellyfishAllyArt },
  { id: 'sea-rabbit', label: '바다토끼', enemyArt: seaRabbitEnemyArt, allyArt: seaRabbitAllyArt },
]

export function randomCreature(): CreatureDefinition {
  return CREATURES[Math.floor(Math.random() * CREATURES.length)]
}

export function getCreature(id: string): CreatureDefinition | undefined {
  return CREATURES.find((c) => c.id === id)
}
