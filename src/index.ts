import { Game } from '@core/Game'

const root = document.getElementById('app')
if (!root) throw new Error('#app root not found')

new Game(root).boot()
