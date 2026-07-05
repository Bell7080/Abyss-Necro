import type { AbilityId } from '@systems/AbilitySystem'

// Skill cut-in art auto-wiring: drop `src/assets/sprites/skills/skill_00N.webp`
// and it lights up by id (missing files fall back to a tinted name card, so the
// build never breaks while the art trickles in).
const skillArtGlob = import.meta.glob('../assets/sprites/skills/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const skillArtByName: Record<string, string> = {}
for (const [path, url] of Object.entries(skillArtGlob)) {
  const base = path.split('/').pop()!.replace(/\.webp$/, '')
  skillArtByName[base] = url
}

interface SkillFace {
  art: string // skill_00N id
  name: string
  hint: string
  tone: string
}

// The four hive skills, in hex order (1 공격 · 2 급조 · 3 기상 · 4 포획), each
// mapped to its cut-in illustration id and accent tone.
const FACES: Record<AbilityId, SkillFace> = {
  basic: { art: 'skill_001', name: '공격', hint: '이거나 먹어라!', tone: '#9b6cff' },
  raise: { art: 'skill_002', name: '급조', hint: '얘들아…! 막아!', tone: '#7ff0b0' },
  'raise-all': { art: 'skill_003', name: '기상', hint: '모두 일어나!', tone: '#ffce7a' },
  capture: { art: 'skill_004', name: '포획', hint: '넌 내꺼야!', tone: '#d69cff' },
}

const HOLD_MS = 620
const CLEAR_MS = 1260

// Left-side skill cut-in — a mirror of the right inspector's anatomy. When a
// skill is cast the panel slides in from the left showing that skill's
// illustration, holds a beat, then fades out. Display-only.
export class SkillCastPanel {
  private readonly panel: HTMLElement
  private readonly artEl: HTMLElement
  private readonly nameEl: HTMLElement
  private readonly hintEl: HTMLElement
  private current: AbilityId | null = null
  private fadeTimer: number | null = null
  private clearTimer: number | null = null

  constructor(root: HTMLElement) {
    this.panel = document.createElement('div')
    this.panel.className = 'skill-cast'
    this.panel.setAttribute('aria-hidden', 'true')
    this.panel.innerHTML = `
      <div class="skill-cast-scrim" aria-hidden="true">
        <div class="skill-cast-art"></div>
        <div class="skill-cast-grad"></div>
      </div>
      <div class="skill-cast-body">
        <div class="skill-cast-name"></div>
        <div class="skill-cast-hint"></div>
      </div>`
    this.artEl = this.panel.querySelector('.skill-cast-art') as HTMLElement
    this.nameEl = this.panel.querySelector('.skill-cast-name') as HTMLElement
    this.hintEl = this.panel.querySelector('.skill-cast-hint') as HTMLElement
    root.appendChild(this.panel)
  }

  /** Slide the skill's illustration in, then fade it out. Re-casting the same
   * skill while it's still up just extends the hold (no jittery re-slide). */
  show(id: AbilityId): void {
    const face = FACES[id]
    if (!face) return

    if (id !== this.current) {
      const art = skillArtByName[face.art]
      this.artEl.style.backgroundImage = art ? `url('${art}')` : ''
      this.panel.classList.toggle('has-art', !!art)
      this.nameEl.textContent = face.name
      this.hintEl.textContent = face.hint
      this.panel.style.setProperty('--cast-tone', face.tone)
      this.current = id
      // Restart the slide-in for a fresh skill.
      this.panel.classList.remove('is-shown', 'is-fading')
      void this.panel.offsetWidth
      this.panel.classList.add('is-shown')
    } else {
      // Same skill again — cancel any pending fade and keep it up.
      this.panel.classList.remove('is-fading')
      this.panel.classList.add('is-shown')
    }

    if (this.fadeTimer !== null) window.clearTimeout(this.fadeTimer)
    if (this.clearTimer !== null) window.clearTimeout(this.clearTimer)
    this.fadeTimer = window.setTimeout(() => this.panel.classList.add('is-fading'), HOLD_MS)
    this.clearTimer = window.setTimeout(() => {
      this.panel.classList.remove('is-shown', 'is-fading')
      this.current = null
    }, CLEAR_MS)
  }
}
