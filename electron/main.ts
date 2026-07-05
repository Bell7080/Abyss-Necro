import { app, BrowserWindow, Menu } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged

// The renderer's layout is tuned for this viewport (board ~1660px wide plus
// HUD margins). Windows below it — including big monitors at 125–150% Windows
// display scaling, which shrink the CSS viewport — get a uniform zoom-out so
// the whole battlefield stays on screen instead of cropping at the edges.
const DESIGN_WIDTH = 1600
const DESIGN_HEIGHT = 900

function createWindow(): void {
  const win = new BrowserWindow({
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    useContentSize: true,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#0b0714',
    webPreferences: {
      // .cjs — sandboxed preloads only run CommonJS (see preload.cts).
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // Packaged desktop app has no browser autoplay gate — the OST can fade in
      // the moment the game opens, without waiting for a first click.
      autoplayPolicy: 'no-user-gesture-required',
    },
  })

  // Fit-to-screen: zoom the page down (never up) whenever the content area is
  // smaller than the design viewport. setZoomFactor is transparent to the
  // page — layout math and getBoundingClientRect stay in CSS px.
  const fitZoom = (): void => {
    const [w, h] = win.getContentSize()
    win.webContents.setZoomFactor(Math.min(w / DESIGN_WIDTH, h / DESIGN_HEIGHT, 1))
  }
  win.on('resize', fitZoom)
  win.webContents.on('did-finish-load', fitZoom)

  if (isDev) {
    win.loadURL('http://localhost:3000')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.maximize()
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  // No app menu in a game build: this also kills the default accelerators
  // (Ctrl+R mid-run reload, F11, Ctrl+Shift+I) that autoHideMenuBar left live.
  Menu.setApplicationMenu(null)
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
