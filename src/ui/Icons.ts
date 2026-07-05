// Flat inline-SVG icons, `currentColor` fill/stroke — no emoji, matches Unmelting's Icons.ts convention.
export const Icons = {
  enemyToken(): string {
    return `<svg viewBox="0 0 24 24" width="40" height="40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="12" cy="10" rx="7" ry="6.4" fill="currentColor"/>
      <path d="M6 15c0 2 .8 5 1 6.4M9.4 15.6c0 2 .4 4.6.6 5.6M14 15.6c0 2-.2 4.6-.4 5.6M18 15c0 2-.8 5-1 6.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      <circle cx="9.4" cy="9.6" r="1.2" fill="#0a0716"/>
      <circle cx="14.6" cy="9.6" r="1.2" fill="#0a0716"/>
    </svg>`
  },
  relicGem(): string {
    return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2 4 9l8 13 8-13-8-7Z" fill="currentColor"/>
      <path d="M4 9h16M8.5 9 12 2l3.5 7M9 9l3 12 3-12" stroke="#0a0716" stroke-width="0.8" stroke-linejoin="round" fill="none"/>
    </svg>`
  },
  /** Capture marker: a little skull for enemies weak enough to claim
   * ("넌 내꺼야!"). Color/glow come from CSS. */
  captureSkull(): string {
    return `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2.5c-5 0-8.5 3.4-8.5 8 0 2.7 1.3 4.7 3 6v2.4c0 1 .8 1.8 1.8 1.8h7.4c1 0 1.8-.8 1.8-1.8V16.5c1.7-1.3 3-3.3 3-6 0-4.6-3.5-8-8.5-8Z" fill="currentColor"/>
      <circle cx="8.6" cy="11" r="2.1" fill="#0a0716"/>
      <circle cx="15.4" cy="11" r="2.1" fill="#0a0716"/>
      <path d="M12 14.5l-1.1 2.2h2.2L12 14.5Z" fill="#0a0716"/>
    </svg>`
  },
  /** 급조 target: an up-chevron rising from a ground line — "여기서 일으켜". */
  raiseHand(): string {
    return `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 15 12 9l6 6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 9v9" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M5 21h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>`
  },
  /** Basic attack: a curse shot streaking away with trailing bubbles. */
  curseBolt(): string {
    return `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="15.8" cy="8.2" r="4.4" fill="currentColor"/>
      <path d="M3.4 20.6c3.4-1.2 6.8-3.8 9-6.8M2.6 15.2c2.3-.6 4.5-1.9 6.2-3.5M8.6 22c2.8-1.3 5.6-3.6 7.6-6.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
      <circle cx="6.9" cy="9.3" r="1.1" fill="currentColor"/>
    </svg>`
  },
  /** Ultimate: an all-directions rupture — long cardinal rays, short
   * diagonals, and a dashed orbit ring for the mystic read. */
  curseBurst(): string {
    return `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="3.4" fill="currentColor"/>
      <path d="M12 1.6v4M12 18.4v4M1.6 12h4M18.4 12h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M5.3 5.3l1.9 1.9M16.8 16.8l1.9 1.9M18.7 5.3l-1.9 1.9M7.2 16.8l-1.9 1.9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="12" cy="12" r="7.6" stroke="currentColor" stroke-width="1" stroke-dasharray="1.8 3.6" stroke-linecap="round"/>
    </svg>`
  },
  /** Four-point sparkle diamond — Unmelting's shared 불빛/화폐 glyph shape,
   * reused here for the abyss coin currency (color comes from CSS). */
  coinSparkle(): string {
    return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2.8 14.1 9.9 21.2 12 14.1 14.1 12 21.2 9.9 14.1 2.8 12 9.9 9.9 12 2.8Z" fill="currentColor"/>
    </svg>`
  },
  /** Open book — the 도감(codex) launcher glyph, flat-iconic per the Unmelting
   * compendium convention (color/glow come from CSS). */
  book(): string {
    return `<svg viewBox="0 0 24 24" width="46" height="46" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.4 5.4c2.8-.4 5.6-.2 7.6 1.2v12c-2-1.4-4.8-1.6-7.6-1.2V5.4Z" fill="currentColor"/>
      <path d="M20.6 5.4c-2.8-.4-5.6-.2-7.6 1.2v12c2-1.4 4.8-1.6 7.6-1.2V5.4Z" fill="currentColor"/>
      <path d="M12 6.6v12" stroke="#0a0716" stroke-width="1" stroke-linecap="round"/>
    </svg>`
  },
  /** Down chevron — codex "다음 몹" slide navigation (rotate via CSS for up). */
  chevronDown(): string {
    return `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 8.5 12 15.5 19 8.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
  },
  /** Close X for overlays. */
  closeMark(): string {
    return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
    </svg>`
  },
  /** Sacral transformation arrow — cold(before) → warm(after) sweep for the
   * codex before/after pairing (gradient applied via CSS currentColor). */
  necroArrow(): string {
    return `<svg viewBox="0 0 44 16" width="44" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 8h34M30 3l7 5-7 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
  },
  itemVial(): string {
    return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 2h4M10 2v5.6L5.8 16a2.8 2.8 0 0 0 2.5 4h7.4a2.8 2.8 0 0 0 2.5-4L14 7.6V2" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="currentColor" fill-opacity="0.18"/>
      <path d="M7.8 14.2h8.4" stroke="currentColor" stroke-width="1.3"/>
    </svg>`
  },
}
