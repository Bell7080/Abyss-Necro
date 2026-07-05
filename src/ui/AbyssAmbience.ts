// Display-only ambience over the whole screen: an edge vignette that pools
// natural darkness around the HUD, plus two oversized "caustic" light sheets
// drifting at different speeds so the water reads as gently rippling. Pure
// CSS animation (transform only, GPU-composited), pointer-blind, no state.
export class AbyssAmbience {
  constructor(root: HTMLElement) {
    const el = document.createElement('div')
    el.className = 'abyss-ambience'
    el.setAttribute('aria-hidden', 'true')
    el.innerHTML = `
      <div class="abyss-caustic abyss-caustic--a"></div>
      <div class="abyss-caustic abyss-caustic--b"></div>
      <div class="abyss-caustic abyss-caustic--c"></div>
      <div class="abyss-ambience-vignette"></div>
      <div class="abyss-ambience-rightfog"></div>`
    root.appendChild(el)
  }
}
