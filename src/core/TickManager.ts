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

  /** Registers a recurring callback. If start() already ran, the entry
   * begins ticking immediately; otherwise it waits for start(). */
  register(callback: () => void, intervalMs: number): void {
    const entry: TickEntry = { callback, intervalMs, timerId: null }
    this.entries.push(entry)
    if (this.running) entry.timerId = window.setInterval(callback, intervalMs)
  }

  start(): void {
    if (this.running) return
    this.running = true
    for (const entry of this.entries) {
      entry.timerId = window.setInterval(entry.callback, entry.intervalMs)
    }
  }

  stop(): void {
    if (!this.running) return
    this.running = false
    for (const entry of this.entries) {
      if (entry.timerId !== null) window.clearInterval(entry.timerId)
      entry.timerId = null
    }
  }
}
