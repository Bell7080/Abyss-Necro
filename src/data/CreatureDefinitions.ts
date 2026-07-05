// Art auto-wiring: every creature's before(enemy)/after(necromanced ally) art
// is resolved by id from these folders — drop `src/assets/sprites/enemies/<id>.webp`
// and `.../allies/<id>.webp` and it lights up automatically (missing files just
// fall back to the flat watermark icon on the board, so the build never breaks
// while the roster's art trickles in).
const enemyArtGlob = import.meta.glob('../assets/sprites/enemies/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>
const allyArtGlob = import.meta.glob('../assets/sprites/allies/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>

function byBase(glob: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [path, url] of Object.entries(glob)) {
    const base = path.split('/').pop()!.replace(/\.webp$/, '')
    out[base] = url
  }
  return out
}
const enemyArtByName = byBase(enemyArtGlob)
const allyArtByName = byBase(allyArtGlob)

// Each entry is the before (enemy) / after (necromanced ally) pair the whole
// card loop revolves around. `passive` is the signature ability shown in the
// inspector; `passiveId` is the machine key the systems act on. To keep the
// roster broad on a tight budget, passives map onto a small set of wired
// mechanics (see below) with creature-flavored text — every card's passive
// actually does something. `tone` is the dominant illustration color the codex
// window tints toward. Art is resolved by id (see the glob above), so enemyArt/
// allyArt may be undefined until the webp lands.
//
// Each creature carries TWO passives: one that fires while it's an ENEMY
// (before), one while it's a necromanced ALLY (after). Both map onto a small
// set of wired mechanics with creature-flavored text.
//
// Ally-form mechanics (passiveId):
//   jelly-amp   — 이 칸에 있는 적이 받는 피해 +1 (electric types)
//   rabbit-heal — 처치될 때 인접 아군 회복 (soft/support types)
//   crab-guard  — 배치 시 더 많은 체력으로 등장 (shelled/tanky types)
//   cleave      — 공격이 그 칸의 모든 적을 함께 때린다 (여러명 공격, 다지체)
//   devour      — 적을 처치하면 잡아먹으며 공격력이 영구 +1 (포식, 포식자)
export type PassiveId = 'jelly-amp' | 'rabbit-heal' | 'crab-guard' | 'cleave' | 'devour'

// Enemy-form mechanics (enemyPassiveId), wired in WaveSystem:
//   ferocious — 아군/플레이어를 칠 때 피해 +1 (predators)
//   armor     — 받는 피해 -1 (min 1) (shelled/tanky)
//   regen     — 교전 중이 아닐 때 체력 회복 (soft/regenerating)
//   cleave    — 공격이 그 칸의 모든 아군을 함께 때린다 (여러명 공격, 다지체)
//   devour    — 아군을 처치하면 잡아먹으며 공격력이 +1 (포식, 포식자)
export type EnemyPassiveId = 'ferocious' | 'armor' | 'regen' | 'cleave' | 'devour'

export interface CreatureDefinition {
  id: string
  label: string
  /** Power level (1 = weakest). Drives BOTH the enemy stats and the necromanced
   * ally stats (see data/Tiers), so every creature is a distinct, clearly-
   * separated power step — no two mobs share a similar spec. */
  level: number
  /** Resolved by id from the sprite folders — undefined until art is added. */
  enemyArt: string | undefined
  allyArt: string | undefined
  /** Flavor shown in the codex "before" (enemy) column. */
  enemyDesc: string
  /** Dominant illustration color — the codex window tints toward this. */
  tone: string
  /** Enemy-form passive (before). */
  enemyPassive: string
  enemyPassiveId: EnemyPassiveId
  /** Necromanced-ally-form passive (after). */
  passive: string
  passiveId: PassiveId
}

interface CreatureSeed {
  id: string
  label: string
  level: number
  enemyDesc: string
  tone: string
  enemyPassive: string
  enemyPassiveId: EnemyPassiveId
  passive: string
  passiveId: PassiveId
}

// The 40-creature target roster, seeded. Existing art: jellyfish/sea-rabbit/crab.
// Elites (piranha·pufferfish·marlin·whale·shark) also live here so their
// before/after art flows through the same pipeline; their tough stats are set
// at spawn in WaveSystem (ELITE_BY_WAVE), not here.
const SEEDS: CreatureSeed[] = [
  // ── normal roster, ordered by level (= the order waves introduce them) ──
  { id: 'jellyfish', label: '해파리', level: 1, tone: 'rgba(96, 128, 214, 0.5)', enemyDesc: '심연을 부유하는 반투명 포식자. 스치는 촉수마다 저릿한 냉기를 흘린다.', enemyPassive: '감전 촉수 — 아군을 공격할 때 피해를 1 추가로 준다.', enemyPassiveId: 'ferocious', passive: '감전 점막 — 이 칸에 있는 적이 받는 피해가 1 증가한다.', passiveId: 'jelly-amp' },
  { id: 'sea-rabbit', label: '바다토끼', level: 2, tone: 'rgba(140, 108, 212, 0.5)', enemyDesc: '심해를 폴짝이며 무리 짓는 연약한 생물. 방심하면 순식간에 불어난다.', enemyPassive: '왕성한 번식 — 교전 중이 아닐 때 체력을 조금씩 회복한다.', enemyPassiveId: 'regen', passive: '폭신 도약 — 처치될 때 인접한 아군의 체력을 2 회복시킨다.', passiveId: 'rabbit-heal' },
  { id: 'clownfish', label: '흰동가리', level: 3, tone: 'rgba(240, 150, 70, 0.45)', enemyDesc: '말미잘 사이를 오가며 무리를 지키는 주황빛 물고기.', enemyPassive: '말미잘 치유 — 교전 중이 아닐 때 체력을 조금씩 회복한다.', enemyPassiveId: 'regen', passive: '말미잘 보호 — 처치될 때 인접한 아군의 체력을 회복시킨다.', passiveId: 'rabbit-heal' },
  { id: 'shrimp', label: '새우', level: 4, tone: 'rgba(232, 140, 120, 0.45)', enemyDesc: '투명한 등을 튕기며 재빠르게 헤엄치는 작은 갑각류.', enemyPassive: '얇은 갑각 — 받는 피해가 1 감소한다.', enemyPassiveId: 'armor', passive: '탈피 — 단단한 겉껍질로 더 많은 체력을 지니고 배치된다.', passiveId: 'crab-guard' },
  { id: 'plankton', label: '플랑크톤', level: 5, tone: 'rgba(122, 200, 176, 0.45)', enemyDesc: '희미하게 발광하며 조류를 타고 떼로 떠도는 미소 생물.', enemyPassive: '증식 — 교전 중이 아닐 때 체력을 조금씩 회복한다.', enemyPassiveId: 'regen', passive: '미광 포자 — 처치될 때 인접한 아군의 체력을 회복시킨다.', passiveId: 'rabbit-heal' },
  { id: 'starfish', label: '불가사리', level: 6, tone: 'rgba(220, 110, 120, 0.45)', enemyDesc: '느릿하게 바닥을 기며 잃은 팔도 다시 돋우는 붉은 별.', enemyPassive: '재생 팔 — 교전 중이 아닐 때 체력을 조금씩 회복한다.', enemyPassiveId: 'regen', passive: '재생 팔 — 두꺼운 몸으로 더 많은 체력을 지니고 배치된다.', passiveId: 'crab-guard' },
  { id: 'hermit-crab', label: '소라게', level: 7, tone: 'rgba(220, 120, 110, 0.45)', enemyDesc: '남의 소라 껍데기를 빌려 짊어진 수줍은 방랑자.', enemyPassive: '소라 방패 — 받는 피해가 1 감소한다.', enemyPassiveId: 'armor', passive: '빌린 껍데기 — 단단한 소라로 더 많은 체력을 지니고 배치된다.', passiveId: 'crab-guard' },
  { id: 'clam', label: '조개', level: 8, tone: 'rgba(170, 160, 210, 0.45)', enemyDesc: '진주빛 속살을 굳게 닫아 지키는 이매패.', enemyPassive: '굳게 닫은 껍데기 — 받는 피해가 1 감소한다.', enemyPassiveId: 'armor', passive: '진주 껍데기 — 두꺼운 껍데기로 더 많은 체력을 지니고 배치된다.', passiveId: 'crab-guard' },
  { id: 'scallop', label: '가리비', level: 9, tone: 'rgba(230, 160, 120, 0.45)', enemyDesc: '조가비를 여닫으며 통통 튀어 이동하는 부채꼴 조개.', enemyPassive: '조가비 방패 — 받는 피해가 1 감소한다.', enemyPassiveId: 'armor', passive: '조가비 방패 — 두꺼운 조가비로 더 많은 체력을 지니고 배치된다.', passiveId: 'crab-guard' },
  { id: 'axolotl', label: '우파루파', level: 10, tone: 'rgba(240, 150, 190, 0.45)', enemyDesc: '분홍빛 아가미를 하늘거리며 웃는 듯한 얼굴의 도롱뇽.', enemyPassive: '재생 — 교전 중이 아닐 때 체력을 조금씩 회복한다.', enemyPassiveId: 'regen', passive: '재생 — 처치될 때 인접한 아군의 체력을 회복시킨다.', passiveId: 'rabbit-heal' },
  { id: 'seahorse', label: '해마', level: 11, tone: 'rgba(220, 180, 90, 0.45)', enemyDesc: '꼬리를 말아 해초에 매달린 채 잔잔히 떠 있는 물고기.', enemyPassive: '골판 비늘 — 받는 피해가 1 감소한다.', enemyPassiveId: 'armor', passive: '잔잔한 물결 — 처치될 때 인접한 아군의 체력을 회복시킨다.', passiveId: 'rabbit-heal' },
  { id: 'crab', label: '꽃게', level: 12, tone: 'rgba(198, 92, 108, 0.46)', enemyDesc: '두꺼운 등껍질로 몸을 감싼 심연의 파수꾼. 좀처럼 무너지지 않는다.', enemyPassive: '단단한 등껍질 — 받는 피해가 1 감소한다.', enemyPassiveId: 'armor', passive: '단단한 등껍질 — 두꺼운 껍질로 더 많은 체력을 지니고 배치된다.', passiveId: 'crab-guard' },
  { id: 'octopus', label: '문어', level: 13, tone: 'rgba(170, 110, 200, 0.5)', enemyDesc: '여덟 팔로 먹물을 흩뿌리며 그늘 속으로 스미는 지능적 포식자.', enemyPassive: '여덟 팔 — 그 칸의 모든 아군을 한꺼번에 공격한다.', enemyPassiveId: 'cleave', passive: '여덟 팔 — 그 칸의 모든 적을 한꺼번에 공격한다.', passiveId: 'cleave' },
  { id: 'squid', label: '오징어', level: 14, tone: 'rgba(120, 120, 200, 0.5)', enemyDesc: '제트 분사로 쏘아지듯 헤엄치며 먹물 장막을 치는 두족류.', enemyPassive: '먹물 장막 — 그 칸의 모든 아군을 한꺼번에 공격한다.', enemyPassiveId: 'cleave', passive: '먹물 장막 — 그 칸의 모든 적을 한꺼번에 공격한다.', passiveId: 'cleave' },
  // ── elites (round bosses). Enemy stats come from WaveSystem.ELITE_BY_WAVE;
  //    level here only feeds their captured-ally / codex stats. ──
  { id: 'piranha', label: '피라냐', level: 7, tone: 'rgba(210, 90, 90, 0.5)', enemyDesc: '굶주린 이빨을 드러내며 떼로 달려드는 사나운 물고기.', enemyPassive: '굶주린 이빨 — 아군을 잡아먹으면 공격력이 오른다.', enemyPassiveId: 'devour', passive: '굶주린 이빨 — 적을 잡아먹을 때마다 공격력이 영구히 오른다.', passiveId: 'devour' },
  { id: 'pufferfish', label: '복어', level: 9, tone: 'rgba(220, 200, 110, 0.5)', enemyDesc: '위협을 느끼면 몸을 부풀려 가시를 곤두세우는 독한 물고기.', enemyPassive: '부푼 가시 — 받는 피해가 1 감소한다.', enemyPassiveId: 'armor', passive: '가시 부풀리기 — 부푼 몸으로 더 많은 체력을 지니고 배치된다.', passiveId: 'crab-guard' },
  { id: 'marlin', label: '청새치', level: 11, tone: 'rgba(90, 140, 210, 0.5)', enemyDesc: '긴 창부리를 앞세워 바다를 가르며 돌진하는 청빛 사냥꾼.', enemyPassive: '관통 창 — 그 칸의 모든 아군을 한꺼번에 꿰뚫는다.', enemyPassiveId: 'cleave', passive: '관통 창 — 그 칸의 모든 적을 한꺼번에 꿰뚫는다.', passiveId: 'cleave' },
  { id: 'whale', label: '고래', level: 13, tone: 'rgba(80, 110, 180, 0.5)', enemyDesc: '심연을 가득 메우는 거구. 그 그림자만으로 물이 무겁다.', enemyPassive: '심연의 거구 — 받는 피해가 1 감소한다.', enemyPassiveId: 'armor', passive: '심연의 거구 — 압도적인 체력을 지니고 배치된다.', passiveId: 'crab-guard' },
  { id: 'shark', label: '상어', level: 14, tone: 'rgba(120, 140, 170, 0.5)', enemyDesc: '심연의 지배자. 날카로운 이빨과 무자비한 속도로 모든 것을 삼킨다.', enemyPassive: '심연의 이빨 — 아군을 잡아먹으면 공격력이 오른다.', enemyPassiveId: 'devour', passive: '심연의 이빨 — 적을 잡아먹을 때마다 공격력이 영구히 오른다.', passiveId: 'devour' },
]

export const CREATURES: CreatureDefinition[] = SEEDS.map((s) => ({
  ...s,
  enemyArt: enemyArtByName[s.id],
  allyArt: allyArtByName[s.id],
}))

const BY_ID = new Map(CREATURES.map((c) => [c.id, c]))

export function getCreature(id: string): CreatureDefinition | undefined {
  return BY_ID.get(id)
}
