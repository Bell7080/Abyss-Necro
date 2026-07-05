// A passive firing on a specific cell — WaveSystem (jelly-amp/cleave/devour on
// combat) and DefenderSystem (rabbit-heal/crab-guard on death/place) both emit
// these, and Game plays the matching blast at that cell. `kind` names the visual
// directly so both enemy- and ally-form passives can share the effect layer.
export type PassiveFx = 'spark' | 'heal' | 'shield' | 'cleave' | 'devour'

export interface PassiveEvent {
  kind: PassiveFx
  cellIndex: number
}
