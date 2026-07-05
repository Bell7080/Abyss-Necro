import type { AbilityId } from '@systems/AbilitySystem'

// Skill art auto-wiring: drop `src/assets/sprites/skill_00N.webp` and it lights
// up by id everywhere it's used (cut-in panel, hive hex icons). Missing files
// just fall back to a flat tint, so the build never breaks while art trickles in.
const skillArtGlob = import.meta.glob('../assets/sprites/skill_*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const skillArtByName: Record<string, string> = {}
for (const [path, url] of Object.entries(skillArtGlob)) {
  const base = path.split('/').pop()!.replace(/\.webp$/, '')
  skillArtByName[base] = url
}

// The four hive skills, in hex order (1 공격 · 2 급조 · 3 기상 · 4 포획), each
// mapped to its illustration id, accent tone, catchphrase (hint — shown in the
// cast cut-in), and a plain mechanical description (desc — shown in the hover
// inspector alongside cost).
export const SKILL_FACES: Record<AbilityId, { art: string; name: string; hint: string; desc: string; tone: string }> = {
  basic: {
    art: 'skill_001',
    name: '공격',
    hint: '이거나 먹어라!',
    desc: '칸을 클릭해 그 칸의 적에게 즉시 피해를 입힌다.',
    tone: '#9b6cff',
  },
  raise: {
    art: 'skill_002',
    name: '급조',
    hint: '얘들아…! 막아!',
    desc: '유해 하나를 급조 언데드로 일으켜 그 칸에 세운다.',
    tone: '#7ff0b0',
  },
  'raise-all': {
    art: 'skill_003',
    name: '기상',
    hint: '모두 일어나!',
    desc: '필드에 있는 모든 유해를 한 번에 일으킨다.',
    tone: '#ffce7a',
  },
  capture: {
    art: 'skill_004',
    name: '포획',
    hint: '넌 내꺼야!',
    desc: '체력이 낮은 적을 저격해 즉시 처치하고 확정 카드를 얻는다.',
    tone: '#d69cff',
  },
}

export function getSkillArt(id: AbilityId): string | undefined {
  return skillArtByName[SKILL_FACES[id].art]
}
