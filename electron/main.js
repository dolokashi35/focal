import { app, BrowserWindow, ipcMain, desktopCapturer } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import Store from 'electron-store'
// active-win may export as default or CJS; resolve dynamically in ESM
let activeWinFn = null
async function getActiveWinFn() {
  if (activeWinFn) return activeWinFn
  const mod = await import('active-win')
  activeWinFn = mod.default || mod
  return activeWinFn
}

const store = new Store({ name: 'focuslens-settings' })
const ingestBuffer = []
let ingestInterval /** @type {NodeJS.Timeout | null} */ = null

/**
 * Simple productivity rules.
 */
const PRODUCTIVE_KEYWORDS = [
  'code', 'vscode', 'xcode', 'android studio', 'intellij', 'pycharm', 'webstorm', 'terminal', 'iterm', 'warp', 'notion', 'google docs', 'docs', 'sheets', 'slides', 'figma', 'postman', 'cursor', 'datagrip'
]
const DISTRACTING_KEYWORDS = [
  'youtube', 'instagram', 'twitter', 'tiktok', 'reddit', 'netflix', 'prime video', 'spotify', 'music'
]

let mainWindow /** @type {BrowserWindow | null} */ = null
let trackerInterval /** @type {NodeJS.Timeout | null} */ = null
let screenshotInterval /** @type {NodeJS.Timeout | null} */ = null
let trackingEnabled = false

function classifyProductivity(title) {
  const lower = (title || '').toLowerCase()
  if (PRODUCTIVE_KEYWORDS.some(k => lower.includes(k))) return { label: 'productive', score: 1 }
  if (DISTRACTING_KEYWORDS.some(k => lower.includes(k))) return { label: 'distracting', score: -1 }
  return { label: 'neutral', score: 0 }
}

async function createWindow() {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  const isDev = !app.isPackaged
  if (isDev) {
    await mainWindow.loadURL('http://localhost:5181')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    await mainWindow.loadFile(path.join(process.cwd(), 'dist', 'index.html'))
  }

  if (store.get('trackingEnabled')) {
    startTracker()
  }
}

function startTracker() {
  if (trackingEnabled) return
  trackingEnabled = true
  store.set('trackingEnabled', true)
  if (trackerInterval) clearInterval(trackerInterval)
  trackerInterval = setInterval(async () => {
    try {
      const info = await getActiveInfo()
      const payload = {
        app: info?.app || info?.owner?.name || 'Unknown',
        title: info?.title || '',
        url: extractUrl(info?.title || ''), // crude heuristic for browsers
        ts: Date.now(),
      }
      const analysis = classifyProductivity(`${payload.app} ${payload.title}`)
      mainWindow?.webContents.send('tracker:update', { ...payload, analysis })
      bufferForIngest({ ...payload, analysis })
    } catch (err) {
      // ignore transient errors
    }
  }, 2000)

  // optional tiny screenshots every ~10s
  maybeStartScreenshots()
}

function stopTracker() {
  trackingEnabled = false
  store.set('trackingEnabled', false)
  if (trackerInterval) { clearInterval(trackerInterval); trackerInterval = null }
  if (screenshotInterval) { clearInterval(screenshotInterval); screenshotInterval = null }
}

function extractUrl(title) {
  // naive: find http(s) substring in title
  const m = (title || '').match(/https?:\/\/\S+/)
  return m ? m[0] : undefined
}

async function getActiveInfo() {
  // Try native module first (Windows/Linux), fallback to AppleScript on macOS
  try {
    const aw = await getActiveWinFn()
    const res = await aw()
    if (res && (res.title || res?.owner?.name)) return res
  } catch (_) {}
  if (process.platform === 'darwin') {
    try {
      const app = await runOSA('tell application "System Events" to get name of first application process whose frontmost is true')
      const title = await runOSA('tell application "System Events"\n  tell (first application process whose frontmost is true)\n    try\n      return name of window 1\n    on error\n      return ""\n    end try\n  end tell\nend tell')
      return { app: String(app).trim(), title: String(title).trim() }
    } catch (_) {}
  }
  return { app: 'Unknown', title: '' }
}

function runOSA(script) {
  return new Promise((resolve, reject) => {
    execFile('/usr/bin/osascript', ['-e', script], { timeout: 1500 }, (err, stdout) => {
      if (err) return reject(err)
      resolve(stdout)
    })
  })
}

ipcMain.handle('analyzer:classify', (_e, text) => classifyProductivity(text))

ipcMain.handle('tracker:status', () => ({ enabled: trackingEnabled }))
ipcMain.handle('tracker:start', () => { startTracker(); return { enabled: true } })
ipcMain.handle('tracker:stop', () => { stopTracker(); return { enabled: false } })

ipcMain.handle('settings:get', () => {
  return {
    openaiKey: store.get('openaiKey') || '',
    geminiKey: store.get('geminiKey') || '',
    model: store.get('model') || 'openai:gpt-4o-mini',
    screenshotEnabled: store.get('screenshotEnabled') || false,
    ingestUrl: store.get('ingestUrl') || '',
    ingestEnabled: store.get('ingestEnabled') || false,
  }
})

ipcMain.handle('settings:set', (_e, kv) => {
  Object.entries(kv || {}).forEach(([k, v]) => store.set(k, v))
  if (kv && Object.prototype.hasOwnProperty.call(kv, 'screenshotEnabled')) {
    maybeStartScreenshots()
  }
  if (kv && (Object.prototype.hasOwnProperty.call(kv, 'ingestEnabled') || Object.prototype.hasOwnProperty.call(kv, 'ingestUrl'))) {
    maybeStartIngest()
  }
  return true
})

// User profile persistence (simple local store)
ipcMain.handle('profile:get', () => {
  return store.get('userProfile') || { username: '@you', level: 3, rank: 128, goalHours: 20, avatarUrl: '' }
})

ipcMain.handle('profile:set', (_e, profile) => {
  const next = Object.assign({}, store.get('userProfile') || {}, profile || {})
  store.set('userProfile', next)
  return next
})

ipcMain.handle('ai:help', async (_e, { title, visibleText }) => {
  // load env once
  try { (await import('dotenv')).config?.() } catch {}
  const model = store.get('model') || 'openai:gpt-4o-mini'
  const openaiKey = process.env.OPENAI_API_KEY || store.get('openaiKey')
  const geminiKey = process.env.GEMINI_API_KEY || store.get('geminiKey')
  const prompt = `You are FocusLens, a helpful assistant. Current context title: "${title}". Visible text: "${(visibleText || '').slice(0, 2000)}". Provide concise, actionable help.`
  try {
    if (String(model).startsWith('openai:')) {
      if (!openaiKey) throw new Error('Missing OpenAI API key')
      const { OpenAI } = await import('openai')
      const client = new OpenAI({ apiKey: openaiKey })
      const res = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      })
      return res.choices?.[0]?.message?.content || 'No response'
    } else {
      if (!geminiKey) throw new Error('Missing Gemini API key')
      const { GoogleGenerativeAI } = await import('@google/generative-ai')
      const genAI = new GoogleGenerativeAI(geminiKey)
      const m = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
      const res = await m.generateContent(prompt)
      return res.response.text()
    }
  } catch (e) {
    return `Error: ${e.message}`
  }
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

async function maybeStartScreenshots() {
  const enabled = !!store.get('screenshotEnabled')
  if (screenshotInterval) { clearInterval(screenshotInterval); screenshotInterval = null }
  if (!enabled) return
  screenshotInterval = setInterval(async () => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 320, height: 180 } })
      const primary = sources?.[0]
      const dataUrl = primary?.thumbnail?.toDataURL()
      if (dataUrl) {
        mainWindow?.webContents.send('tracker:screenshot', { ts: Date.now(), dataUrl })
      }
    } catch (_) {
      // ignore
    }
  }, 10000)
}

function bufferForIngest(event) {
  if (!store.get('ingestEnabled')) return
  ingestBuffer.push(event)
}

async function maybeStartIngest() {
  if (ingestInterval) { clearInterval(ingestInterval); ingestInterval = null }
  if (!store.get('ingestEnabled')) return
  ingestInterval = setInterval(async () => {
    if ( ingestBuffer.length === 0 ) return
    const url = store.get('ingestUrl')
    if (!url) return
    const batch = ingestBuffer.splice(0, ingestBuffer.length)
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ts: Date.now(), events: batch }),
      })
    } catch (_) {
      // put back for retry later
      ingestBuffer.unshift(...batch)
    }
  }, 30000)
}


