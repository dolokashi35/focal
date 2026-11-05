import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ActivityTracker } from './src/tracker/index.js'
import { FocusAPI } from './src/net/api.js'
import Store from 'electron-store'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

class FocusAI {
  constructor() {
    this.tray = null
    this.window = null
    this.tracker = null
    this.api = new FocusAPI()
    this.store = new Store({ name: 'focus-ai' })
    this.currentScore = 0
    this.currentLabel = 'on_task'
    this.currentNudge = 'Stay focused!'
    this.isTracking = false
    
    this.init()
  }

  async init() {
    await app.whenReady()
    this.createTray()
    this.createWindow()
    this.setupIPC()
    this.startAutoLaunch()
  }

  createTray() {
    // Create tray icon (you'll need to add an icon file)
    const iconPath = path.join(__dirname, 'assets', 'tray-icon.png')
    const icon = nativeImage.createFromPath(iconPath)
    this.tray = new Tray(icon.resize({ width: 16, height: 16 }))
    
    this.updateTrayMenu()
  }

  updateTrayMenu() {
    const menu = Menu.buildFromTemplate([
      {
        label: `Focus Score: ${this.currentScore}`,
        enabled: false
      },
      {
        label: `Status: ${this.currentLabel}`,
        enabled: false
      },
      { type: 'separator' },
      {
        label: this.isTracking ? 'Stop Tracking' : 'Start Tracking',
        click: () => this.toggleTracking()
      },
      {
        label: 'Show Dashboard',
        click: () => this.showWindow()
      },
      {
        label: 'Settings',
        click: () => this.showSettings()
      },
      { type: 'separator' },
      {
        label: 'Quit Focus AI',
        click: () => app.quit()
      }
    ])
    
    this.tray.setContextMenu(menu)
    this.tray.setToolTip(`Focus AI - Score: ${this.currentScore}`)
  }

  createWindow() {
    this.window = new BrowserWindow({
      width: 400,
      height: 600,
      show: false,
      resizable: false,
      skipTaskbar: true,
      webPreferences: {
        preload: path.join(__dirname, 'src', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    this.window.loadFile(path.join(__dirname, 'src', 'renderer', 'index.html'))

    this.window.on('blur', () => {
      this.window.hide()
    })

    this.window.on('closed', () => {
      this.window = null
    })
  }

  showWindow() {
    if (this.window) {
      this.window.show()
      this.window.focus()
    }
  }

  showSettings() {
    // Create settings window
    const settingsWindow = new BrowserWindow({
      width: 600,
      height: 500,
      webPreferences: {
        preload: path.join(__dirname, 'src', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    })
    
    settingsWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'settings.html'))
  }

  setupIPC() {
    ipcMain.handle('get-focus-data', () => ({
      score: this.currentScore,
      label: this.currentLabel,
      nudge: this.currentNudge,
      isTracking: this.isTracking
    }))

    ipcMain.handle('toggle-tracking', () => {
      this.toggleTracking()
      return this.isTracking
    })

    ipcMain.handle('get-settings', () => {
      return this.store.store
    })

    ipcMain.handle('set-settings', (_, settings) => {
      this.store.set(settings)
      this.api.updateConfig(settings)
      return true
    })
  }

  toggleTracking() {
    if (this.isTracking) {
      this.stopTracking()
    } else {
      this.startTracking()
    }
    this.updateTrayMenu()
  }

  startTracking() {
    if (this.tracker) return
    
    this.tracker = new ActivityTracker({
      onActivity: (data) => this.handleActivity(data),
      screenshotInterval: 30000, // 30 seconds
      batchInterval: 20000 // 20 seconds
    })
    
    this.tracker.start()
    this.isTracking = true
  }

  stopTracking() {
    if (this.tracker) {
      this.tracker.stop()
      this.tracker = null
    }
    this.isTracking = false
  }

  async handleActivity(data) {
    try {
      // Send to AWS for processing
      const response = await this.api.classifyActivity(data)
      
      if (response) {
        this.currentScore = response.focus_score
        this.currentLabel = response.label
        this.currentNudge = response.nudge
        
        this.updateTrayMenu()
        
        // Show notification for important nudges
        if (response.label === 'off_task' || response.label === 'drifting') {
          this.showNotification(response.nudge)
        }
      }
    } catch (error) {
      console.error('Failed to process activity:', error)
    }
  }

  showNotification(message) {
    if (this.tray) {
      this.tray.displayBalloon({
        title: 'Focus AI',
        content: message,
        icon: nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray-icon.png'))
      })
    }
  }

  startAutoLaunch() {
    const isEnabled = this.store.get('autoLaunch', true)
    if (isEnabled) {
      app.setLoginItemSettings({
        openAtLogin: true,
        name: 'Focus AI'
      })
    }
  }
}

// Initialize the app
new FocusAI()

app.on('window-all-closed', () => {
  // Keep app running in tray
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    // Recreate window if needed
  }
})


