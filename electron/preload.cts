// .cts on purpose: the root package.json is "type": "module", so a plain .ts
// here would compile to an ESM .js — which Electron's (default) sandboxed
// preload loader can't run at all ("Unable to load preload script"). .cts
// forces a CommonJS .cjs artifact, the only flavor sandboxed preloads accept.
import { contextBridge } from 'electron'

// Placeholder bridge — extend as the renderer needs privileged APIs (save file, etc).
contextBridge.exposeInMainWorld('abyssNecro', {
  version: process.env.npm_package_version ?? 'dev',
})
