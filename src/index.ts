import { Game } from '@core/Game'
import { CustomCursor } from '@ui/CustomCursor'
import { FontManager } from '@ui/FontManager'
import { ClickRipple } from '@ui/effects/ClickRipple'
import griunFontUrl from '@/assets/fonts/griun_simsimche.woff2'

FontManager.loadCustomFont({ family: 'Griun Simsimche', url: griunFontUrl })
FontManager.setPrimaryFamily(`'Griun Simsimche', system-ui, sans-serif`)
FontManager.setPrimaryWeight(700)

// Global, always-on regardless of what's on screen: the themed pointer and
// its click ripple work the same on the intro veil, overlays, and in-game.
CustomCursor.install()
ClickRipple.install()

const root = document.getElementById('app')
if (!root) throw new Error('#app root not found')

new Game(root).boot()
