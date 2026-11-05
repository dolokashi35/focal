import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('focuslens', {
  onTrackerUpdate: (callback) => ipcRenderer.on('tracker:update', (_event, value) => callback(value)),
  onScreenshot: (callback) => ipcRenderer.on('screenshot:update', (_event, value) => callback(value)),
  classify: (text) => ipcRenderer.invoke('analyzer:classify', text),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (kv) => ipcRenderer.invoke('settings:set', kv),
  askHelp: (data) => ipcRenderer.invoke('ai:help', data),
  getProfile: () => ipcRenderer.invoke('profile:get'),
  setProfile: (kv) => ipcRenderer.invoke('profile:set', kv),
  getTrackingStatus: () => ipcRenderer.invoke('tracker:status'),
  startTracking: () => ipcRenderer.invoke('tracker:start'),
  stopTracking: () => ipcRenderer.invoke('tracker:stop'),
})

