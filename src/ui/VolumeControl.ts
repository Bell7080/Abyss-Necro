export interface VolumeControlOptions {
  initial: number
  onChange: (v: number) => void
}

// Persistent line-and-star music volume slider, fixed top-right — the same
// spot on the title screen, the tutorial dialogue, and in-game (nothing else
// lives up there). Display/input only; the actual volume state lives in
// AudioManager via onChange. Starts invisible and fades in with the title
// reveal (Game calls reveal()), then simply stays for the whole session.
export class VolumeControl {
  private readonly box: HTMLElement

  constructor(root: HTMLElement, opts: VolumeControlOptions) {
    this.box = document.createElement('div')
    this.box.className = 'volume-ctrl'
    this.box.setAttribute('role', 'slider')
    this.box.setAttribute('aria-label', '음악 볼륨')
    this.box.innerHTML = `
      <span class="volume-ctrl-note" aria-hidden="true">♪</span>
      <div class="volume-ctrl-track">
        <div class="volume-ctrl-fill"></div>
        <span class="volume-ctrl-star" aria-hidden="true">✦</span>
      </div>`
    root.appendChild(this.box)

    const track = this.box.querySelector('.volume-ctrl-track') as HTMLElement
    const fill = this.box.querySelector('.volume-ctrl-fill') as HTMLElement
    const star = this.box.querySelector('.volume-ctrl-star') as HTMLElement

    const render = (v: number): void => {
      const pct = Math.round(v * 100)
      fill.style.width = `${pct}%`
      star.style.left = `${pct}%`
      this.box.classList.toggle('is-muted', v <= 0.001)
      this.box.setAttribute('aria-valuenow', `${pct}`)
    }
    render(opts.initial)

    const setFromX = (clientX: number): void => {
      const rect = track.getBoundingClientRect()
      const v = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
      render(v)
      opts.onChange(v)
    }

    // Pointer events stop here so adjusting never doubles as a click on
    // whatever screen is underneath (title click-to-start, board cells, …).
    this.box.addEventListener('click', (e) => e.stopPropagation())
    this.box.addEventListener('pointerdown', (e) => {
      e.stopPropagation()
      this.box.setPointerCapture(e.pointerId)
      this.box.classList.add('is-dragging')
      setFromX(e.clientX)
    })
    this.box.addEventListener('pointermove', (e) => {
      if (this.box.classList.contains('is-dragging')) setFromX(e.clientX)
    })
    const release = (): void => this.box.classList.remove('is-dragging')
    this.box.addEventListener('pointerup', release)
    this.box.addEventListener('pointercancel', release)
  }

  /** Fades the slider in — fired with the title screen's reveal. */
  reveal(): void {
    this.box.classList.add('is-visible')
  }
}
