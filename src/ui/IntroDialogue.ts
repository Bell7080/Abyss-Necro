import portraitNeutral from '@/assets/sprites/player_002.webp'
import portraitSmile from '@/assets/sprites/player_003.webp'
import portraitCry from '@/assets/sprites/player_004.webp'
import { getAllyArt, getCreature } from '@data/CreatureDefinitions'
import { entityCardHtml } from '@ui/EntityCard'

export interface IntroDialogueHandlers {
  /** Live rect of the wave HUD's "웨이브 N · MM:SS" text — the countdown's
   * final beat blasts into it before the run actually starts. Intro mode
   * only; the ending has no countdown. */
  getWaveTimeRect?: () => DOMRect | null
  /** Intro: fired once the countdown lands (Game wires this to startRun()).
   * Ending: fired after the last line — Game raises the victory veil OVER
   * the still-visible dialogue. */
  onComplete: () => void
}

type Portrait = 2 | 3 | 4

interface ScriptLine {
  portrait: Portrait
  text: string
  /** Runs before this line's text starts typing. */
  before?: () => void | Promise<void>
  /** Runs after this line is fully shown and the player has advanced past it. */
  after?: () => void | Promise<void>
}

const PORTRAIT_SRC: Record<Portrait, string> = {
  2: portraitNeutral,
  3: portraitSmile,
  4: portraitCry,
}

const NAME = '넥슈'
// Typewriter speed, and the click-to-advance gating once a line finishes
// revealing: ignored for ADVANCE_LOCK_MS, then a click (or ADVANCE_TIMEOUT_MS
// with no click at all) moves on.
const TYPE_MS = 32
const ADVANCE_LOCK_MS = 750
const ADVANCE_TIMEOUT_MS = 6000
const PORTRAIT_SWAP_OUT_MS = 110
const PORTRAIT_SWAP_IN_MS = 260
const COUNTDOWN_HOLD_MS = 700
const COUNTDOWN_FLY_MS = 520

const FIRST_TRIO = ['jellyfish', 'piranha', 'octopus']
const CUTE_TRIO = ['jellyfish', 'hermit-crab', 'crab']
// Scatter sits right of screen-center: the portrait (shifted to the left
// third during the card show) stays clear of even the leftmost card's label.
const CARD_OFFSETS = [
  { x: -183, y: -22, rot: -9 },
  { x: 105, y: 52, rot: 5 },
  { x: 343, y: -42, rot: -5 },
]

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

/** A handful of small bubbles bursting outward — the same "sung/necro'd"
 * flourish used for corpse spawns, reused here for card transforms. */
function bubbleBurstHtml(): string {
  return Array.from({ length: 7 }, () => {
    const angle = Math.random() * 360
    const dist = 22 + Math.random() * 30
    const dx = (Math.cos((angle * Math.PI) / 180) * dist).toFixed(1)
    const size = (6 + Math.random() * 9).toFixed(1)
    const delay = (Math.random() * 0.16).toFixed(2)
    return `<span class="intro-card-bubble" style="--bubble-dx:${dx}px;--bubble-size:${size}px;--bubble-delay:${delay}s"></span>`
  }).join('')
}

// 넥슈's cutscene dialogue, in two modes sharing one machinery/style.
// 'intro' — auto-plays once the title screen's board-reveal finishes (see
// IntroOverlay): typewriter lines, portrait swaps, a staged prop show (enemy
// cards → necro'd allies → tier 2 → a tier-3 cameo) building to a countdown
// that blasts into the wave HUD and actually starts the run.
// 'ending' — plays over the frozen board once the final boss (상어) falls:
// the same dim/box/typing, a short farewell script, then onComplete raises
// the victory veil OVER the dialogue (no dim-clear, no countdown).
// Display/sequence only — real state changes stay in Game.
export class IntroDialogue {
  private readonly root: HTMLElement
  private readonly cardsLayer: HTMLElement
  private readonly countdownLayer: HTMLElement
  private readonly stageEl: HTMLElement
  private readonly portraitMain: HTMLImageElement
  private readonly portraitShadow: HTMLImageElement
  private readonly textEl: HTMLElement

  private cardEls: HTMLElement[] = []
  private skipTyping: (() => void) | null = null
  private advanceNow: (() => void) | null = null
  private advanceForce: (() => void) | null = null
  private currentPortrait: Portrait | null = null
  // SKIP pressed — the script loop bails out and jumps straight to finish().
  private skipped = false
  private finishStarted = false

  constructor(
    root: HTMLElement,
    private readonly handlers: IntroDialogueHandlers,
    private readonly mode: 'intro' | 'ending' = 'intro'
  ) {
    this.root = document.createElement('div')
    this.root.className = 'intro-dialogue'
    this.root.innerHTML = `
      <div class="intro-dlg-dim" aria-hidden="true"></div>
      <div class="intro-dlg-cards" aria-hidden="true"></div>
      <div class="intro-dlg-countdown" aria-hidden="true"></div>
      <div class="intro-dlg-stage" aria-hidden="true">
        <img class="intro-dlg-portrait-shadow" alt="" />
        <img class="intro-dlg-portrait-main" alt="" />
      </div>
      <div class="intro-dlg-box">
        <div class="intro-dlg-box-inner">
          <div class="intro-dlg-name">${NAME}</div>
          <div class="intro-dlg-divider" aria-hidden="true"></div>
          <div class="intro-dlg-text"></div>
        </div>
      </div>
      <button type="button" class="intro-dlg-skip">SKIP ▸</button>`
    root.appendChild(this.root)

    this.cardsLayer = this.root.querySelector('.intro-dlg-cards') as HTMLElement
    this.countdownLayer = this.root.querySelector('.intro-dlg-countdown') as HTMLElement
    this.stageEl = this.root.querySelector('.intro-dlg-stage') as HTMLElement
    this.portraitMain = this.root.querySelector('.intro-dlg-portrait-main') as HTMLImageElement
    this.portraitShadow = this.root.querySelector('.intro-dlg-portrait-shadow') as HTMLImageElement
    this.textEl = this.root.querySelector('.intro-dlg-text') as HTMLElement

    this.root.addEventListener('click', () => this.handleClick())
    const skipBtn = this.root.querySelector('.intro-dlg-skip') as HTMLButtonElement
    skipBtn.addEventListener('click', (e) => {
      e.stopPropagation() // must not double as a line-advance click
      this.handleSkip()
    })

    void this.play()
  }

  /** SKIP: aborts the remaining script — the current line resolves at once,
   * the play loop bails, and finish() (dim clear → countdown) takes over. */
  private handleSkip(): void {
    if (this.skipped || this.finishStarted) return
    this.skipped = true
    this.skipTyping?.()
    this.advanceForce?.()
  }

  private handleClick(): void {
    if (this.skipTyping) {
      this.skipTyping()
      return
    }
    this.advanceNow?.()
  }

  private async play(): Promise<void> {
    requestAnimationFrame(() => this.root.classList.add('is-dim-visible'))
    await wait(650)
    this.root.classList.add('is-box-visible')
    await wait(250)

    const script = this.mode === 'ending' ? this.buildEndingScript() : this.buildScript()
    for (const line of script) {
      if (this.skipped) break
      if (line.before) await line.before()
      await this.showLine(line)
      if (this.skipped) break
      if (line.after) await line.after()
    }
    // SKIP path — the last line's own after() never ran, so close out here.
    if (this.skipped) await this.finish()
  }

  private buildScript(): ScriptLine[] {
    return [
      { portrait: 2, text: '안녕? 내 이름은 넥슈라고 해! 위대한 심연의 네크로멘서지!' },
      { portrait: 2, text: '외로운 심해에는 늘 친구가 필요해...' },
      { portrait: 3, text: '오늘도 한번 열심히 친구를 만들어 보자!' },
      {
        portrait: 2,
        text: '이 심해에는 다양한 친구 후보들이 살아!',
        before: () => {
          this.root.classList.add('is-shifted')
          this.spawnCards(FIRST_TRIO, (id) => getCreature(id)?.enemyArt, 'enemy')
        },
      },
      { portrait: 4, text: '근데... 이 친구들은 날 별로 안 좋아하는 거 같아...' },
      {
        portrait: 2,
        text: '그래도 괜찮아! 다들 날 좋아하게 만들면 되는 거니까!',
        after: () => this.transformCards((id) => getAllyArt(id, 1), 1),
      },
      { portrait: 3, text: '적을 잡아서 아군으로 사령할 수 있어!' },
      { portrait: 4, text: '그리고 중요한 부분이야!' },
      {
        portrait: 3,
        text: '바로 바로... 같은 적 카드를 3장 모으면  더 강해진다는 것!',
        after: () => this.transformCards((id) => getAllyArt(id, 2), 2, 'is-tier2'),
      },
      {
        portrait: 2,
        text: '이제 우리의 목표는 알겠지? 많은 친구를 사귀는 거야!',
        after: () => this.hideCards(),
      },
      {
        portrait: 2,
        text: '흐흐, 그리고 그 중에선... 정말 귀여운 친구들도 있다구!',
        after: () => this.flashCuteTrio(),
      },
      { portrait: 3, text: '어쩌면 나보다 귀여울지도 모르겠어...' },
      {
        portrait: 2,
        text: '아무튼! 이제 놀이터로 가볼까?',
        after: () => this.finish(),
      },
    ]
  }

  /** 1차 엔딩 — 최종 보스(상어)까지 사령해 "심해의 모든 친구"를 사귄 뒤의
   * 작별 인사. 소품 연출 없이 대사만 흐르고, 마지막 줄에서 승리 베일이
   * 이 대화창 위로 덮인다. */
  private buildEndingScript(): ScriptLine[] {
    return [
      { portrait: 3, text: '드디어...! 모든 바다 생물들과 친구가 됐어!' },
      { portrait: 2, text: '오늘 정말 재밌었지?' },
      { portrait: 3, text: '다음에 또 놀자! 그때는 내가 더 재밌는 이야기를 많이 가져올게!' },
      {
        portrait: 3,
        text: '더 발전된 우리를 기대해줘?',
        after: () => this.finish(),
      },
    ]
  }

  /** Swaps the portrait — first appearance just reveals it; a later swap
   * flashes the old art out and the new one in with a quick afterimage-like
   * pop rather than an abrupt cut. The trailing shadow copy always mirrors
   * the main image (no separate transition of its own). */
  private setPortrait(portrait: Portrait): void {
    if (this.currentPortrait === portrait) return
    const first = this.currentPortrait === null
    this.currentPortrait = portrait
    const src = PORTRAIT_SRC[portrait]

    if (first) {
      this.portraitMain.src = src
      this.portraitShadow.src = src
      requestAnimationFrame(() => this.stageEl.classList.add('is-portrait-visible'))
      return
    }

    this.portraitMain.classList.add('is-swap-out')
    window.setTimeout(() => {
      this.portraitMain.src = src
      this.portraitShadow.src = src
      this.portraitMain.classList.remove('is-swap-out')
      this.portraitMain.classList.add('is-swap-in')
      window.setTimeout(() => this.portraitMain.classList.remove('is-swap-in'), PORTRAIT_SWAP_IN_MS)
    }, PORTRAIT_SWAP_OUT_MS)
  }

  /** Types out one line, letting a click fast-forward it, then waits out the
   * advance gate (locked for ADVANCE_LOCK_MS, then a click or
   * ADVANCE_TIMEOUT_MS moves on). */
  private async showLine(line: ScriptLine): Promise<void> {
    this.setPortrait(line.portrait)
    this.textEl.textContent = ''
    this.textEl.classList.remove('is-line-settled')

    const full = line.text
    let revealed = 0
    let fastForward = false

    await new Promise<void>((resolve) => {
      this.skipTyping = () => {
        fastForward = true
      }
      const timer = window.setInterval(() => {
        const target = fastForward ? full.length : revealed + 1
        while (revealed < target) {
          // Each char pops in on its own (see .intro-dlg-char) — appending it
          // at the moment it's revealed is what gives the typewriter its
          // "다라라락 띠용띠용" staggered bounce, no extra delay math needed.
          const span = document.createElement('span')
          span.className = 'intro-dlg-char'
          // inline-block trims a solitary space char as leading/trailing
          // whitespace of its own mini formatting context — swap in a
          // non-breaking space so word gaps survive the per-char wrap.
          span.textContent = full[revealed] === ' ' ? ' ' : full[revealed]
          this.textEl.appendChild(span)
          revealed++
        }
        if (revealed >= full.length) {
          window.clearInterval(timer)
          this.skipTyping = null
          this.textEl.classList.add('is-line-settled')
          resolve()
        }
      }, TYPE_MS)
    })

    // SKIP landed mid-typing — don't sit out the advance gate.
    if (this.skipped) return

    await new Promise<void>((resolve) => {
      let locked = true
      const finish = (): void => {
        window.clearTimeout(unlockTimer)
        window.clearTimeout(autoTimer)
        this.advanceNow = null
        this.advanceForce = null
        resolve()
      }
      const unlockTimer = window.setTimeout(() => {
        locked = false
      }, ADVANCE_LOCK_MS)
      const autoTimer = window.setTimeout(finish, ADVANCE_TIMEOUT_MS)
      this.advanceNow = () => {
        if (!locked) finish()
      }
      // SKIP bypasses the lock entirely.
      this.advanceForce = finish
    })
  }

  /** Scatters a trio of cards center-stage — enemy (before) form by default. */
  private spawnCards(
    ids: string[],
    artFor: (id: string) => string | undefined,
    variant: 'enemy' | 'ally' = 'enemy',
    tierClass?: string,
    stars?: number
  ): void {
    this.cardsLayer.innerHTML = ''
    this.cardEls = ids.map((id, i) => {
      const creature = getCreature(id)
      const offset = CARD_OFFSETS[i] ?? { x: 0, y: 0, rot: 0 }
      const el = document.createElement('div')
      el.className = 'intro-card is-entering'
      el.dataset.creatureId = id
      el.style.setProperty('--card-x', `${offset.x}px`)
      el.style.setProperty('--card-y', `${offset.y}px`)
      el.style.setProperty('--card-rot', `${offset.rot}deg`)
      el.innerHTML = `<div class="intro-card-shadow" aria-hidden="true"></div>${entityCardHtml({
        variant,
        imageUrl: artFor(id),
        name: creature?.label,
        stars,
      })}`
      if (tierClass) el.querySelector('.entity-card')?.classList.add(tierClass)
      this.cardsLayer.appendChild(el)
      return el
    })
    this.cardEls.forEach((el, i) => {
      window.setTimeout(() => el.classList.remove('is-entering'), 40 + i * 90)
    })
  }

  /** Bubble-blast each current card, then swap its art/variant in place —
   * used both for the enemy→ally reveal and the tier-1→tier-2 upgrade. Ally
   * forms carry their tier's ★ rank, same badge as hand/board cards. */
  private async transformCards(
    artFor: (id: string) => string | undefined,
    stars: number,
    tierClass?: string
  ): Promise<void> {
    for (const el of this.cardEls) {
      const burst = document.createElement('div')
      burst.className = 'intro-card-burst'
      burst.innerHTML = bubbleBurstHtml()
      el.appendChild(burst)
      window.setTimeout(() => burst.remove(), 700)
    }
    await wait(260)
    for (const el of this.cardEls) {
      const id = el.dataset.creatureId
      if (!id) continue
      const img = el.querySelector<HTMLImageElement>('.entity-card-image')
      const url = artFor(id)
      if (img && url) img.src = url
      const card = el.querySelector('.entity-card')
      card?.classList.remove('entity-card--enemy')
      card?.classList.add('entity-card--ally')
      if (tierClass) card?.classList.add(tierClass)
      const content = card?.querySelector('.entity-card-content')
      if (content) {
        let starsEl = content.querySelector('.entity-card-stars')
        if (!starsEl) {
          starsEl = document.createElement('div')
          starsEl.className = 'entity-card-stars'
          content.prepend(starsEl)
        }
        starsEl.textContent = '★'.repeat(stars)
        starsEl.setAttribute('aria-label', `${stars}성`)
      }
    }
    await wait(420)
  }

  private async hideCards(): Promise<void> {
    if (this.cardEls.length === 0) return
    this.cardEls.forEach((el) => el.classList.add('is-leaving'))
    await wait(520)
    this.cardsLayer.innerHTML = ''
    this.cardEls = []
  }

  /** A dramatic, brief cameo for the 3성 "cutest" trio — pops in, holds, then
   * fades away before the next line. */
  private async flashCuteTrio(): Promise<void> {
    this.spawnCards(CUTE_TRIO, (id) => getAllyArt(id, 3), 'ally', 'is-tier3', 3)
    await wait(1700)
    await this.hideCards()
  }

  /** The closing beat: the dim backdrop clears to reveal the (still idle)
   * board, the dialogue/portrait fade away, then a big countdown blasts its
   * last number into the wave HUD's timer — which is when the run actually
   * starts (see onComplete). */
  private async finish(): Promise<void> {
    // Runs once — reachable from both the last line's after() and SKIP.
    if (this.finishStarted) return
    this.finishStarted = true
    // A skip mid-card-show would otherwise strand the prop cards on screen.
    void this.hideCards()
    if (this.mode === 'ending') {
      // The victory veil (z 600) rises OVER the still-lit dialogue (z 260) —
      // no dim-clear, no countdown; the overlay's own fade owns the close.
      this.handlers.onComplete()
      return
    }
    this.root.classList.add('is-dim-clearing')
    await wait(1000)
    this.root.classList.add('is-gone')
    await wait(600)
    await this.runCountdown()
    this.root.remove()
    this.handlers.onComplete()
  }

  private async runCountdown(): Promise<void> {
    let lastEl: HTMLElement | null = null
    for (const n of [5, 4, 3, 2, 1]) {
      this.countdownLayer.innerHTML = ''
      const el = document.createElement('div')
      el.className = 'intro-countdown-num'
      el.textContent = `${n}`
      this.countdownLayer.appendChild(el)
      lastEl = el
      await wait(COUNTDOWN_HOLD_MS)
    }
    if (!lastEl) return

    const target = this.handlers.getWaveTimeRect?.() ?? null
    if (!target) return
    const from = lastEl.getBoundingClientRect()
    const dx = target.left + target.width / 2 - (from.left + from.width / 2)
    const dy = target.top + target.height / 2 - (from.top + from.height / 2)
    lastEl.style.setProperty('--fly-x', `${dx}px`)
    lastEl.style.setProperty('--fly-y', `${dy}px`)
    lastEl.classList.add('is-flying')
    await wait(COUNTDOWN_FLY_MS)
  }
}
