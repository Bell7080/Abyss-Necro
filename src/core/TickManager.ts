interface TickEntry {
  callback: () => void
  intervalMs: number
  timerId: number | null
}

// Owns every recurring window.setInterval the run needs (enemy movement,
// cost regen, …) so systems register their cadence here instead of each
// spinning up its own timer. start()/stop() is then a single lever for the
// whole game clock — useful now for the intro-gated boot, and later for any
// full-game pause. One-shot/self-rescheduling timeouts (e.g. WaveSystem's
// push timer, which pauses/resumes on its own schedule) stay local to their
// system — they aren't a fixed cadence, so folding them in here would just
// add indirection without a real win.
export class TickManager {
  private readonly entries: TickEntry[] = []
  private running = false
  private rate = 1

  /** Registers a recurring callback. If start() already ran, the entry
   * begins ticking immediately; otherwise it waits for start(). */
  register(callback: () => void, intervalMs: number): void {
    const entry: TickEntry = { callback, intervalMs, timerId: null }
    this.entries.push(entry)
    if (this.running) this.arm(entry)
  }

  start(): void {
    if (this.running) return
    this.running = true
    for (const entry of this.entries) this.arm(entry)
  }

  stop(): void {
    if (!this.running) return
    this.running = false
    for (const entry of this.entries) this.disarm(entry)
  }

  /** Global game-speed multiplier (aim-mode slow motion) — re-arms every
   * running interval at intervalMs / rate. 1 = normal speed. */
  setRate(rate: number): void {
    if (rate === this.rate) return
    this.rate = rate
    if (!this.running) return
    for (const entry of this.entries) {
      this.disarm(entry)
      this.arm(entry)
    }
  }

  private arm(entry: TickEntry): void {
    entry.timerId = window.setInterval(entry.callback, entry.intervalMs / this.rate)
  }

  private disarm(entry: TickEntry): void {
    if (entry.timerId !== null) window.clearInterval(entry.timerId)
    entry.timerId = null
  }
}
