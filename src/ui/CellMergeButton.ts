// A sparkling merge button that floats above a board cell holding three
// identical allies — the on-board sibling of the hand's MergeButton.
// Clicking fuses the trio into one 2-star ally. Positioned in screen space
// over the cell (the board's 3D tilt is baked into the cell's rect).
export class CellMergeButton {
  private readonly button: HTMLButtonElement

  constructor(root: HTMLElement, onClick: () => void) {
    this.button = document.createElement('button')
    this.button.type = 'button'
    this.button.className = 'cell-merge-button'
    this.button.innerHTML = `<span class="cell-merge-star">✦</span><span class="cell-merge-label">합성</span>`
    this.button.addEventListener('click', onClick)
    root.appendChild(this.button)
  }

  /** Show centered horizontally on the cell, sitting just above its top. */
  showAt(x: number, y: number): void {
    this.button.style.left = `${x}px`
    this.button.style.top = `${y}px`
    this.button.classList.add('is-visible')
  }

  hide(): void {
    this.button.classList.remove('is-visible')
  }
}
