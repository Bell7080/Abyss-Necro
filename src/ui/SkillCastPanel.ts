import type { AbilityId } from '@systems/AbilitySystem'
import { SKILL_FACES, getSkillArt } from '@ui/SkillArt'

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
    const face = SKILL_FACES[id]
    if (!face) return

    if (id !== this.current) {
      const art = getSkillArt(id)
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
