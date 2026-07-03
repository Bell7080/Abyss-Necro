import type { PassiveId } from '@data/CreatureDefinitions'

// A passive firing on a specific cell — WaveSystem (jelly-amp on damage) and
// DefenderSystem (rabbit-heal on death) both emit these, and Game plays the
// matching blast at that cell.
export interface PassiveEvent {
  passiveId: PassiveId
  cellIndex: number
}
