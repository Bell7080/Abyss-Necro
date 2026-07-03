import { Game } from '@core/Game'
import { FontManager } from '@ui/FontManager'
import griunFontUrl from '@/assets/fonts/griun_simsimche.woff2'

FontManager.loadCustomFont({ family: 'Griun Simsimche', url: griunFontUrl })
FontManager.setPrimaryFamily(`'Griun Simsimche', system-ui, sans-serif`)
FontManager.setPrimaryWeight(700)

const root = document.getElementById('app')
if (!root) throw new Error('#app root not found')

new Game(root).boot()
