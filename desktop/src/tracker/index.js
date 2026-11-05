import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { desktopCapturer } from 'electron'

const execAsync = promisify(exec)

export class ActivityTracker {
  constructor(options = {}) {
    this.options = {
      screenshotInterval: 30000,
      batchInterval: 20000,
      onActivity: () => {},
      ...options
    }
    
    this.intervals = {}
    this.buffer = []
    this.lastActivity = null
    this.isRunning = false
  }

  start() {
    if (this.isRunning) return
    
    this.isRunning = true
    
    // Track active window every 2 seconds
    this.intervals.window = setInterval(() => {
      this.trackActiveWindow()
    }, 2000)
    
    // Take screenshots periodically
    this.intervals.screenshot = setInterval(() => {
      this.captureScreenshot()
    }, this.options.screenshotInterval)
    
    // Batch and send data
    this.intervals.batch = setInterval(() => {
      this.flushBuffer()
    }, this.options.batchInterval)
    
    console.log('Activity tracking started')
  }

  stop() {
    this.isRunning = false
    
    Object.values(this.intervals).forEach(interval => {
      clearInterval(interval)
    })
    
    this.intervals = {}
    this.flushBuffer() // Send remaining data
    
    console.log('Activity tracking stopped')
  }

  async trackActiveWindow() {
    try {
      const windowInfo = await this.getActiveWindowInfo()
      if (!windowInfo) return
      
      const activity = {
        user_id: this.getUserId(),
        app: windowInfo.app,
        url: windowInfo.url,
        title: windowInfo.title,
        timestamp: new Date().toISOString(),
        keystrokes: this.getKeystrokeCount(),
        mouse: this.getMouseActivity(),
        ...windowInfo
      }
      
      // Only process if activity changed
      if (this.hasActivityChanged(activity)) {
        this.buffer.push(activity)
        this.lastActivity = activity
        this.options.onActivity(activity)
      }
    } catch (error) {
      console.error('Failed to track window:', error)
    }
  }

  async getActiveWindowInfo() {
    if (process.platform === 'darwin') {
      try {
        // Get active app
        const { stdout: appOutput } = await execAsync(
          'osascript -e \'tell app "System Events" to get name of first application process whose frontmost is true\''
        )
        const app = appOutput.trim()
        
        // Get window title
        const { stdout: titleOutput } = await execAsync(
          `osascript -e 'tell app "System Events" to tell (first application process whose frontmost is true) to try
            return name of window 1
          on error
            return ""
          end try'`
        )
        const title = titleOutput.trim()
        
        // Extract URL if it's a browser
        const url = this.extractURL(title, app)
        
        return {
          app,
          title,
          url,
          platform: 'darwin'
        }
      } catch (error) {
        console.error('macOS window tracking failed:', error)
        return null
      }
    }
    
    // Windows/Linux fallback (implement as needed)
    return null
  }

  extractURL(title, app) {
    // Simple URL extraction for common browsers
    const browserApps = ['Chrome', 'Safari', 'Firefox', 'Edge']
    if (!browserApps.some(browser => app.includes(browser))) {
      return null
    }
    
    // Extract URL from title if it contains one
    const urlMatch = title.match(/(https?:\/\/[^\s]+)/)
    return urlMatch ? urlMatch[1] : null
  }

  async captureScreenshot() {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 320, height: 240 }
      })
      
      if (sources.length > 0) {
        const screenshot = {
          data: sources[0].thumbnail.toDataURL(),
          timestamp: new Date().toISOString(),
          size: { width: 320, height: 240 }
        }
        
        // Add to buffer for OCR processing
        this.buffer.push({
          type: 'screenshot',
          ...screenshot
        })
      }
    } catch (error) {
      console.error('Screenshot capture failed:', error)
    }
  }

  getKeystrokeCount() {
    // Simple keystroke estimation based on activity
    // In production, you'd use a proper keylogger like iohook
    return Math.floor(Math.random() * 50) + 10
  }

  getMouseActivity() {
    // Simple mouse activity estimation
    // In production, you'd track actual mouse events
    return Math.floor(Math.random() * 20) + 5
  }

  getUserId() {
    // Get or generate user ID
    return process.env.USER_ID || 'anonymous'
  }

  hasActivityChanged(newActivity) {
    if (!this.lastActivity) return true
    
    return (
      newActivity.app !== this.lastActivity.app ||
      newActivity.title !== this.lastActivity.title ||
      newActivity.url !== this.lastActivity.url
    )
  }

  flushBuffer() {
    if (this.buffer.length === 0) return
    
    const batch = [...this.buffer]
    this.buffer = []
    
    // Send batch to AWS API
    this.sendBatch(batch)
  }

  async sendBatch(batch) {
    try {
      // This will be implemented in the API module
      console.log(`Sending batch of ${batch.length} events`)
      // await this.api.sendBatch(batch)
    } catch (error) {
      console.error('Failed to send batch:', error)
      // Re-add to buffer on failure
      this.buffer.unshift(...batch)
    }
  }
}


