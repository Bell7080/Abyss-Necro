import type { Relic } from '@entities/Relic'

// Flavor-only names until real relic effects/data exist — enough to make a
// 3-choice reward screen read as distinct picks rather than three copies of
// the same placeholder.
const RELIC_NAMES = [
  '심연의 파편',
  '저주받은 반지',
  '낡은 나침반',
  '얼어붙은 심장',
  '잊혀진 해도',
  '검은 진주',
  '녹슨 열쇠',
  '유령 등불',
]

function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function drawRelicOptions(count: number): Relic[] {
  return shuffled(RELIC_NAMES)
    .slice(0, count)
    .map((label) => ({ id: `relic-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, label }))
}
