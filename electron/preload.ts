import { contextBridge } from 'electron'

// Placeholder bridge — extend as the renderer needs privileged APIs (save file, etc).
contextBridge.exposeInMainWorld('abyssNecro', {
  version: process.env.npm_package_version ?? 'dev',
})
