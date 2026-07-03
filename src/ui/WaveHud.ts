import type { WaveSystem } from '@systems/WaveSystem'

const REFRESH_MS = 500

// Top-center "웨이브 N - MM:SS" readout. Polls WaveSystem on its own timer
// since the countdown needs to tick every second regardless of whether any
// game state actually changed.
export class WaveHud {
  private readonly el: HTMLElement

  constructor(root: HTMLElement, private readonly waveSystem: WaveSystem) {
    this.el = document.createElement('div')
    this.el.className = 'wave-hud'
    root.appendChild(this.el)

    this.render()
    window.setInterval(() => this.render(), REFRESH_MS)
  }

  private render(): void {
    const wave = this.waveSystem.getWaveNumber()
    if (this.waveSystem.isPaused()) {
      this.el.textContent = `웨이브 ${wave} - 정비 중`
      return
    }
    const totalSeconds = Math.ceil(this.waveSystem.getRemainingMs() / 1000)
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
    const seconds = String(totalSeconds % 60).padStart(2, '0')
    this.el.textContent = `웨이브 ${wave} - ${minutes}:${seconds}`
  }
}
