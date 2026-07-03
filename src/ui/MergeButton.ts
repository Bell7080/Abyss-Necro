import { Icons } from '@ui/Icons'

// Sparkling "합성" button at the left of the hand fan — appears only while
// the hand holds three identical base cards. Merging is now the player's
// call (this button), not an automatic snap; clicking hands off to Game,
// which runs the jelly-merge fx and the model swap.
export class MergeButton {
  private readonly button: HTMLButtonElement

  constructor(root: HTMLElement, onClick: () => void) {
    this.button = document.createElement('button')
    this.button.type = 'button'
    this.button.className = 'merge-button'
    this.button.innerHTML = `${Icons.coinSparkle()}<span class="merge-button-label">합성</span>`
    this.button.addEventListener('click', onClick)
    root.appendChild(this.button)
  }

  setVisible(visible: boolean): void {
    this.button.classList.toggle('is-visible', visible)
  }
}
