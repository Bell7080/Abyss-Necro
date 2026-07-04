// The unified "합성" button — a big pulsing diamond floating at the center,
// just above the hand fan. Shown whenever a merge is available, whether the
// trio sits in the hand or on a board cell (Game primes which). The candidate
// cards/allies pulse in their own accent colors so it's clear what will fuse.
export class MergeButton {
  private readonly button: HTMLButtonElement

  constructor(root: HTMLElement, onClick: () => void) {
    this.button = document.createElement('button')
    this.button.type = 'button'
    this.button.className = 'merge-button'
    this.button.innerHTML = `
      <span class="merge-button-diamond" aria-hidden="true"></span>
      <span class="merge-button-label">합성</span>`
    this.button.addEventListener('click', onClick)
    root.appendChild(this.button)
  }

  setVisible(visible: boolean): void {
    this.button.classList.toggle('is-visible', visible)
  }
}
