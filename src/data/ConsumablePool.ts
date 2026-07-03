import type { ConsumableItem } from '@entities/ConsumableItem'

// Flavor-only names until real consumable effects/data exist.
const ITEM_NAMES = [
  '작은 치유의 병',
  '냉기 결정',
  '섬광 가루',
  '거미줄 실타래',
  '심연의 소금',
  '박쥐의 날개',
  '유황 조각',
  '검은 촛농',
]

export function drawRandomConsumable(): ConsumableItem {
  const label = ITEM_NAMES[Math.floor(Math.random() * ITEM_NAMES.length)]
  return { id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, label }
}
