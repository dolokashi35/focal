import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('focuslens', {
  onTrackerUpdate: (cb) => {
    const listener = (_e, payload) => cb(payload)
    ipcRenderer.on('tracker:update', listener)
    return () => ipcRenderer.removeListener('tracker:update', listener)
  },
  onScreenshot: (cb) => {
    const listener = (_e, payload) => cb(payload)
    ipcRenderer.on('tracker:screenshot', listener)
    return () => ipcRenderer.removeListener('tracker:screenshot', listener)
  },
  classify: (text) => ipcRenderer.invoke('analyzer:classify', text),
  getTrackingStatus: () => ipcRenderer.invoke('tracker:status'),
  startTracking: () => ipcRenderer.invoke('tracker:start'),
  stopTracking: () => ipcRenderer.invoke('tracker:stop'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (kv) => ipcRenderer.invoke('settings:set', kv),
  getProfile: () => ipcRenderer.invoke('profile:get'),
  setProfile: (profile) => ipcRenderer.invoke('profile:set', profile),
  askHelp: (data) => ipcRenderer.invoke('ai:help', data),
})


