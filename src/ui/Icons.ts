// Flat inline-SVG icons, `currentColor` fill/stroke — no emoji, matches Unmelting's Icons.ts convention.
export const Icons = {
  flowArrow(): string {
    return `<svg viewBox="0 0 24 24" width="52" height="52" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 5 8 12l10 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
  },
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
  curseBolt(): string {
    return `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2 9 11h3l-2 11 8-13h-4l3-9-5 2Z" fill="currentColor"/>
    </svg>`
  },
  curseBurst(): string {
    return `<svg viewBox="0 0 24 24" width="30" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 1v6M12 17v6M1 12h6M17 12h6M4.2 4.2l4.2 4.2M15.6 15.6l4.2 4.2M19.8 4.2l-4.2 4.2M8.4 15.6l-4.2 4.2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="12" cy="12" r="4.4" fill="currentColor"/>
    </svg>`
  },
  /** Four-point sparkle diamond — Unmelting's shared 불빛/화폐 glyph shape,
   * reused here for the abyss coin currency (color comes from CSS). */
  coinSparkle(): string {
    return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2.8 14.1 9.9 21.2 12 14.1 14.1 12 21.2 9.9 14.1 2.8 12 9.9 9.9 12 2.8Z" fill="currentColor"/>
    </svg>`
  },
  itemVial(): string {
    return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 2h4M10 2v5.6L5.8 16a2.8 2.8 0 0 0 2.5 4h7.4a2.8 2.8 0 0 0 2.5-4L14 7.6V2" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="currentColor" fill-opacity="0.18"/>
      <path d="M7.8 14.2h8.4" stroke="currentColor" stroke-width="1.3"/>
    </svg>`
  },
}
