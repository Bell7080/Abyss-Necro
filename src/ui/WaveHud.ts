import type { WaveSystem } from '@systems/WaveSystem'

const REFRESH_MS = 500

// Top-center "웨이브 N - MM:SS" readout. Backing plate removed — the text
// itself carries the emphasis (large, bold, glowing). Polls WaveSystem on its
// own timer since the countdown ticks every second regardless of game state,
// and fires a growing-fading afterimage pulse whenever the wave increments.
export class WaveHud {
  private readonly el: HTMLElement
  private readonly textEl: HTMLElement
  private lastWave = -1

  constructor(root: HTMLElement, private readonly waveSystem: WaveSystem) {
    this.el = document.createElement('div')
    this.el.className = 'wave-hud'
    this.textEl = document.createElement('span')
    this.textEl.className = 'wave-hud-text'
    this.el.appendChild(this.textEl)
    root.appendChild(this.el)

    this.render()
    window.setInterval(() => this.render(), REFRESH_MS)
  }

  /** Live viewport rect of the "웨이브 N · MM:SS" readout — the intro
   * dialogue's final countdown blasts its last number in here. */
  getTimeRect(): DOMRect | null {
    return this.textEl.getBoundingClientRect()
  }

  private render(): void {
    const wave = this.waveSystem.getWaveNumber()
    if (this.waveSystem.isPaused()) {
      this.textEl.textContent = `웨이브 ${wave} · 정비 중`
    } else {
      const totalSeconds = Math.ceil(this.waveSystem.getRemainingMs() / 1000)
      const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
      const seconds = String(totalSeconds % 60).padStart(2, '0')
      this.textEl.textContent = `웨이브 ${wave} · ${minutes}:${seconds}`
    }

    if (wave !== this.lastWave) {
      if (this.lastWave >= 0 && wave > this.lastWave) this.pulse()
      this.lastWave = wave
    }
  }

  /** A ghost clone of the current readout swells and fades over the live text
   * — a single emphatic heartbeat marking the new wave. */
  private pulse(): void {
    this.textEl.classList.remove('is-beat')
    void this.textEl.offsetWidth
    this.textEl.classList.add('is-beat')

    const ghost = document.createElement('span')
    ghost.className = 'wave-hud-ghost'
    ghost.textContent = this.textEl.textContent
    this.el.appendChild(ghost)
    window.setTimeout(() => ghost.remove(), 900)
  }
}
