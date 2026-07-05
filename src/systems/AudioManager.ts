// Audio auto-wiring: drop mp3s into `src/assets/` and they light up by name
// (missing files just no-op, so the build never breaks while audio is still
// being added). Expected names:
//   ost.mp3   — title / victory theme (played from the start)
//   bgm_001.mp3, bgm_002.mp3 — in-battle loops (random pick, re-random on end)
const audioGlob = import.meta.glob('../assets/*.mp3', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const audioByName: Record<string, string> = {}
for (const [path, url] of Object.entries(audioGlob)) {
  const base = path.split('/').pop()!.replace(/\.mp3$/, '')
  audioByName[base] = url
}

// The title/victory theme fades in from the very start of the track (quiet →
// full over this many ms, generous and slow so it's clearly audible coming
// up), and simply loops back to 0 on end.
const OST_FADE_IN_MS = 6000
const FADE_IN_MS = 1600
const FADE_OUT_MS = 1200
// Battle tracks cross-fade near their tail into the next random pick.
const TRACK_TAIL_FADE_MS = 2200
const OST_VOLUME = 0.7
const BGM_VOLUME = 0.6

// Leaving the title screen: the OST doesn't smoothly fade, it guts down in a
// few uneven dips before cutting out — a "투-후-후-훙" stutter cut timed to
// the screen's fade-to-black. Each pair is [ms offset, volume multiplier of
// the level playing when the cut starts].
const OST_STUTTER_STEPS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [70, 0.3],
  [150, 0.52],
  [230, 0.16],
  [310, 0.34],
  [400, 0.05],
  [480, 0],
]

type Mode = 'idle' | 'ost' | 'battle'

// Master volume persists across sessions (title-screen slider sets it).
const VOLUME_STORAGE_KEY = 'abyss-necro-volume'

function loadStoredVolume(): number {
  const raw = window.localStorage.getItem(VOLUME_STORAGE_KEY)
  const v = raw === null ? NaN : Number(raw)
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1
}

// One owner for all music. Handles browser autoplay (defers the first play to
// the first user gesture if the browser blocks it), fades every transition, and
// re-randomizes battle tracks forever until stopped. All internal fades work in
// LOGICAL volume (0..OST/BGM_VOLUME); the element volume actually set is
// logical × master, so the master slider scales everything uniformly without
// the fade math having to know about it.
export class AudioManager {
  private readonly ost: HTMLAudioElement | null
  private readonly battle: HTMLAudioElement | null
  private mode: Mode = 'idle'
  private readonly fadeTimers = new WeakMap<HTMLAudioElement, number>()
  private readonly logicalVolume = new WeakMap<HTMLAudioElement, number>()
  private master = loadStoredVolume()
  // Set while a gesture-deferred play is pending, so we don't stack listeners.
  private pendingGesture: (() => void) | null = null

  constructor() {
    this.ost = audioByName['ost'] ? new Audio(audioByName['ost']) : null
    if (this.ost) {
      this.ost.preload = 'auto'
      // Loop back to the start — every replay re-enters at 0 with the same
      // quiet-to-full fade-in.
      this.ost.addEventListener('ended', () => {
        if (this.mode === 'ost') this.playOst()
      })
    }
    this.battle = this.hasBattleTracks() ? new Audio() : null
    if (this.battle) {
      this.battle.addEventListener('ended', () => {
        if (this.mode === 'battle') this.playRandomBattleTrack()
      })
      // Tail cross-fade: once close to the end, ease the volume down so the
      // hand-off to the next random track reads as one continuous flow.
      this.battle.addEventListener('timeupdate', () => this.handleBattleTail())
    }
  }

  /** Title-screen slider: 0..1, scales every current and future track. */
  setMasterVolume(v: number): void {
    this.master = Math.min(1, Math.max(0, v))
    window.localStorage.setItem(VOLUME_STORAGE_KEY, `${this.master}`)
    for (const el of [this.ost, this.battle]) {
      if (el) this.applyVolume(el, this.logicalVolume.get(el) ?? 0)
    }
  }

  getMasterVolume(): number {
    return this.master
  }

  /** The one place element volume is written — logical level × master. */
  private applyVolume(el: HTMLAudioElement, logical: number): void {
    const clamped = Math.min(1, Math.max(0, logical))
    this.logicalVolume.set(el, clamped)
    el.volume = Math.min(1, Math.max(0, clamped * this.master))
  }

  private hasBattleTracks(): boolean {
    return !!(audioByName['bgm_001'] || audioByName['bgm_002'])
  }

  private battleTracks(): string[] {
    return ['bgm_001', 'bgm_002'].map((n) => audioByName[n]).filter(Boolean) as string[]
  }

  /** Title/victory theme. Plays from the very start of the track, faded in.
   * Used both when the game first opens (intro title scene) and on the 1st-
   * ending victory. */
  playOst(): void {
    if (!this.ost) return
    this.mode = 'ost'
    this.stopBattle(true)
    const el = this.ost
    el.currentTime = 0
    this.tryPlay(el, () => {
      this.applyVolume(el, 0)
      this.fade(el, OST_VOLUME, OST_FADE_IN_MS)
    })
  }

  /** Leaving the title screen: gutter the OST out in a stuttering "투-후-후-훙"
   * cut instead of a smooth fade, timed to the screen cutting to black. */
  duckTitleOst(): void {
    const el = this.ost
    if (!el || el.paused) return
    const prev = this.fadeTimers.get(el)
    if (prev !== undefined) window.clearInterval(prev)
    const start = this.logicalVolume.get(el) ?? el.volume
    for (const [ms, mult] of OST_STUTTER_STEPS) {
      window.setTimeout(() => {
        this.applyVolume(el, start * mult)
      }, ms)
    }
    const lastMs = OST_STUTTER_STEPS[OST_STUTTER_STEPS.length - 1][0]
    window.setTimeout(() => el.pause(), lastMs + 20)
  }

  /** Enter combat: stop the OST and start a random battle loop, faded in. */
  startBattle(): void {
    if (!this.battle) {
      // No battle tracks yet — leave the OST playing so there's still music.
      return
    }
    this.mode = 'battle'
    this.fadeOutStop(this.ost)
    this.playRandomBattleTrack()
  }

  /** Death: fade the current music out and stop (a fresh run will restart it). */
  stopMusic(): void {
    this.mode = 'idle'
    this.fadeOutStop(this.ost)
    this.fadeOutStop(this.battle)
  }

  private playRandomBattleTrack(): void {
    const tracks = this.battleTracks()
    if (!this.battle || tracks.length === 0) return
    // Index chosen from the wall clock so repeats are possible but not locked.
    const src = tracks[Math.floor(Math.random() * tracks.length)]
    const el = this.battle
    el.src = src
    this.tryPlay(el, () => {
      el.currentTime = 0
      this.applyVolume(el, 0)
      this.fade(el, BGM_VOLUME, FADE_IN_MS)
    })
  }

  private handleBattleTail(): void {
    const el = this.battle
    if (!el || this.mode !== 'battle' || !el.duration || !isFinite(el.duration)) return
    const remaining = (el.duration - el.currentTime) * 1000
    const logical = this.logicalVolume.get(el) ?? 0
    if (remaining <= TRACK_TAIL_FADE_MS && logical > 0.02 && this.fadeTimers.get(el) === undefined) {
      this.fade(el, 0, Math.max(300, remaining))
    }
  }

  /** Attempts play; if the browser blocks autoplay, arms the first user gesture
   * to start it instead. `onReady` runs right before the actual play() so
   * currentTime/volume are set at the correct moment. */
  private tryPlay(el: HTMLAudioElement, onReady: () => void): void {
    const attempt = (): Promise<void> => {
      onReady()
      return el.play()
    }
    attempt().catch(() => this.deferToGesture(() => attempt()))
  }

  private deferToGesture(run: () => Promise<void>): void {
    if (this.pendingGesture) return
    const fire = (): void => {
      window.removeEventListener('pointerdown', fire)
      window.removeEventListener('keydown', fire)
      this.pendingGesture = null
      run().catch(() => {})
    }
    this.pendingGesture = fire
    window.addEventListener('pointerdown', fire, { once: true })
    window.addEventListener('keydown', fire, { once: true })
  }

  private fadeOutStop(el: HTMLAudioElement | null): void {
    if (!el || el.paused) return
    this.fade(el, 0, FADE_OUT_MS, () => {
      el.pause()
    })
  }

  /** Linear volume ramp on rAF-less timers (works even when the tab throttles
   * rAF). Operates in LOGICAL volume (master-scaled on write). Cancels any
   * in-flight fade on the same element first. */
  private fade(el: HTMLAudioElement, target: number, ms: number, done?: () => void): void {
    const prev = this.fadeTimers.get(el)
    if (prev !== undefined) window.clearInterval(prev)
    const start = this.logicalVolume.get(el) ?? el.volume
    const steps = Math.max(1, Math.round(ms / 40))
    let i = 0
    const timer = window.setInterval(() => {
      i += 1
      const t = i / steps
      this.applyVolume(el, start + (target - start) * t)
      if (i >= steps) {
        window.clearInterval(timer)
        this.fadeTimers.delete(el)
        done?.()
      }
    }, 40)
    this.fadeTimers.set(el, timer)
  }

  private stopBattle(immediate = false): void {
    if (!this.battle) return
    if (immediate) {
      this.battle.pause()
    } else {
      this.fadeOutStop(this.battle)
    }
  }
}
