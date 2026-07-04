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
// Wired passive mechanics:
//   jelly-amp   — 이 칸에 있는 적이 받는 피해 +1 (offensive/electric types)
//   rabbit-heal — 처치될 때 인접 아군 회복 (soft/support/regen types)
//   crab-guard  — 배치 시 더 많은 체력으로 등장 (shelled/tanky types)
export type PassiveId = 'jelly-amp' | 'rabbit-heal' | 'crab-guard'

export interface CreatureDefinition {
  id: string
  label: string
  /** Resolved by id from the sprite folders — undefined until art is added. */
  enemyArt: string | undefined
  allyArt: string | undefined
  /** Flavor shown in the codex "before" (enemy) column. */
  enemyDesc: string
  /** Dominant illustration color — the codex window tints toward this. */
  tone: string
  passive: string
  passiveId: PassiveId
}

interface CreatureSeed {
  id: string
  label: string
  enemyDesc: string
  tone: string
  passive: string
  passiveId: PassiveId
}

// The 40-creature target roster, seeded. Existing art: jellyfish/sea-rabbit/crab.
// Elites (piranha·pufferfish·marlin·whale·shark) also live here so their
// before/after art flows through the same pipeline; their tough stats are set
// at spawn in WaveSystem (ELITE_BY_WAVE), not here.
const SEEDS: CreatureSeed[] = [
  // ── originals ──
  { id: 'jellyfish', label: '해파리', tone: 'rgba(96, 128, 214, 0.5)', enemyDesc: '심연을 부유하는 반투명 포식자. 스치는 촉수마다 저릿한 냉기를 흘린다.', passive: '감전 점막 — 이 칸에 있는 적이 받는 피해가 1 증가한다.', passiveId: 'jelly-amp' },
  { id: 'sea-rabbit', label: '바다토끼', tone: 'rgba(140, 108, 212, 0.5)', enemyDesc: '심해를 폴짝이며 무리 짓는 연약한 생물. 방심하면 순식간에 불어난다.', passive: '폭신 도약 — 처치될 때 인접한 아군의 체력을 2 회복시킨다.', passiveId: 'rabbit-heal' },
  { id: 'crab', label: '꽃게', tone: 'rgba(198, 92, 108, 0.46)', enemyDesc: '두꺼운 등껍질로 몸을 감싼 심연의 파수꾼. 좀처럼 무너지지 않는다.', passive: '단단한 등껍질 — 두꺼운 껍질로 더 많은 체력을 지니고 배치된다.', passiveId: 'crab-guard' },
  // ── round 1: 얕은 바다 ──
  { id: 'plankton', label: '플랑크톤', tone: 'rgba(122, 200, 176, 0.45)', enemyDesc: '희미하게 발광하며 조류를 타고 떠도는 미소 생물. 하나하나는 약하다.', passive: '미광 포자 — 처치될 때 인접한 아군의 체력을 회복시킨다.', passiveId: 'rabbit-heal' },
  { id: 'shrimp', label: '새우', tone: 'rgba(232, 140, 120, 0.45)', enemyDesc: '투명한 등을 튕기며 재빠르게 헤엄치는 작은 갑각류.', passive: '탈피 — 단단한 겉껍질로 더 많은 체력을 지니고 배치된다.', passiveId: 'crab-guard' },
  { id: 'clownfish', label: '흰동가리', tone: 'rgba(240, 150, 70, 0.45)', enemyDesc: '말미잘 사이를 오가며 무리를 지키는 주황빛 물고기.', passive: '말미잘 보호 — 처치될 때 인접한 아군의 체력을 회복시킨다.', passiveId: 'rabbit-heal' },
  // ── round 2: 산호초 ──
  { id: 'hermit-crab', label: '소라게', tone: 'rgba(220, 120, 110, 0.45)', enemyDesc: '남의 소라 껍데기를 빌려 짊어진 수줍은 방랑자.', passive: '빌린 껍데기 — 단단한 소라로 더 많은 체력을 지니고 배치된다.', passiveId: 'crab-guard' },
  { id: 'clam', label: '조개', tone: 'rgba(170, 160, 210, 0.45)', enemyDesc: '진주빛 속살을 굳게 닫아 지키는 이매패.', passive: '진주 껍데기 — 두꺼운 껍데기로 더 많은 체력을 지니고 배치된다.', passiveId: 'crab-guard' },
  { id: 'scallop', label: '가리비', tone: 'rgba(230, 160, 120, 0.45)', enemyDesc: '조가비를 여닫으며 통통 튀어 이동하는 부채꼴 조개.', passive: '조가비 방패 — 두꺼운 조가비로 더 많은 체력을 지니고 배치된다.', passiveId: 'crab-guard' },
  { id: 'starfish', label: '불가사리', tone: 'rgba(220, 110, 120, 0.45)', enemyDesc: '느릿하게 바닥을 기며 잃은 팔도 다시 돋우는 붉은 별.', passive: '재생 팔 — 두꺼운 몸으로 더 많은 체력을 지니고 배치된다.', passiveId: 'crab-guard' },
  // ── round 3: 중층 ──
  { id: 'axolotl', label: '우파루파', tone: 'rgba(240, 150, 190, 0.45)', enemyDesc: '분홍빛 아가미를 하늘거리며 웃는 듯한 얼굴의 도롱뇽.', passive: '재생 — 처치될 때 인접한 아군의 체력을 회복시킨다.', passiveId: 'rabbit-heal' },
  { id: 'seahorse', label: '해마', tone: 'rgba(220, 180, 90, 0.45)', enemyDesc: '꼬리를 말아 해초에 매달린 채 잔잔히 떠 있는 물고기.', passive: '잔잔한 물결 — 처치될 때 인접한 아군의 체력을 회복시킨다.', passiveId: 'rabbit-heal' },
  { id: 'octopus', label: '문어', tone: 'rgba(170, 110, 200, 0.5)', enemyDesc: '여덟 팔로 먹물을 흩뿌리며 그늘 속으로 스미는 지능적 포식자.', passive: '먹물 감전 — 이 칸에 있는 적이 받는 피해가 1 증가한다.', passiveId: 'jelly-amp' },
  // ── round 4: 심해 ──
  { id: 'squid', label: '오징어', tone: 'rgba(120, 120, 200, 0.5)', enemyDesc: '제트 분사로 쏘아지듯 헤엄치며 먹물 장막을 치는 두족류.', passive: '먹물 방사 — 이 칸에 있는 적이 받는 피해가 1 증가한다.', passiveId: 'jelly-amp' },
  // ── elites (round bosses) ──
  { id: 'piranha', label: '피라냐', tone: 'rgba(210, 90, 90, 0.5)', enemyDesc: '굶주린 이빨을 드러내며 떼로 달려드는 사나운 물고기.', passive: '굶주린 이빨 — 이 칸에 있는 적이 받는 피해가 1 증가한다.', passiveId: 'jelly-amp' },
  { id: 'pufferfish', label: '복어', tone: 'rgba(220, 200, 110, 0.5)', enemyDesc: '위협을 느끼면 몸을 부풀려 가시를 곤두세우는 독한 물고기.', passive: '가시 부풀리기 — 부푼 몸으로 더 많은 체력을 지니고 배치된다.', passiveId: 'crab-guard' },
  { id: 'marlin', label: '청새치', tone: 'rgba(90, 140, 210, 0.5)', enemyDesc: '긴 창부리를 앞세워 바다를 가르며 돌진하는 청빛 사냥꾼.', passive: '관통 창 — 이 칸에 있는 적이 받는 피해가 1 증가한다.', passiveId: 'jelly-amp' },
  { id: 'whale', label: '고래', tone: 'rgba(80, 110, 180, 0.5)', enemyDesc: '심연을 가득 메우는 거구. 그 그림자만으로 물이 무겁다.', passive: '심연의 거구 — 압도적인 체력을 지니고 배치된다.', passiveId: 'crab-guard' },
  { id: 'shark', label: '상어', tone: 'rgba(120, 140, 170, 0.5)', enemyDesc: '심연의 지배자. 날카로운 이빨과 무자비한 속도로 모든 것을 삼킨다.', passive: '심연의 이빨 — 이 칸에 있는 적이 받는 피해가 1 증가한다.', passiveId: 'jelly-amp' },
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
