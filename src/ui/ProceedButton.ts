// Pulsing "진행" button shown below the board during a checkpoint lull
// (every 5 forced waves) so the player can regroup before continuing.
// Hidden the rest of the time. Relic checkpoints skip this — picking a
// relic itself resumes progression.
export class ProceedButton {
  private readonly el: HTMLButtonElement

  constructor(root: HTMLElement, onProceed: () => void) {
    this.el = document.createElement('button')
    this.el.type = 'button'
    this.el.className = 'proceed-button'
    this.el.textContent = '진행'
    this.el.addEventListener('click', () => {
      this.hide()
      onProceed()
    })
    root.appendChild(this.el)
  }

  show(): void {
    this.el.classList.add('is-visible')
  }

  hide(): void {
    this.el.classList.remove('is-visible')
  }
}
