import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Dashboard } from './pages/Dashboard'
import { Analytics as AnalyticsPage } from './pages/Analytics'
import { Sessions as SessionsPage } from './pages/Sessions'
import { Assistant as AssistantPage } from './pages/Assistant'
import { SettingsPage } from './pages/Settings'
import { ProfilePage } from './pages/Profile'

type TrackerEvent = {
  app: string
  title: string
  url?: string
  ts: number
  analysis: { label: 'productive' | 'distracting' | 'neutral'; score: number }
}

type Settings = { openaiKey: string; geminiKey: string; model: string; screenshotEnabled: boolean }

declare global {
  interface Window {
    focuslens: {
      onTrackerUpdate: (cb: (p: TrackerEvent) => void) => () => void
      classify: (text: string) => Promise<{ label: string; score: number }>
      getSettings: () => Promise<Settings>
      setSettings: (kv: Partial<Settings>) => Promise<boolean>
      askHelp: (data: { title: string; visibleText?: string }) => Promise<string>
    }
  }
}

const badgeColor = (label: string) => {
  switch (label) {
    case 'productive':
      return '#16a34a'
    case 'distracting':
      return '#dc2626'
    default:
      return '#6b7280'
  }
}

const Card: React.FC<{ title?: string; right?: React.ReactNode; style?: React.CSSProperties }>
  = ({ children, title, right, style }) => (
  <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, ...style }}>
    {(title || right) && (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 600 }}>{title}</div>
        {right}
      </div>
    )}
    {children}
  </div>
)

const SectionTitle: React.FC<{ label: string }>= ({ label }) => (
  <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.6, margin: '16px 0 8px' }}>{label}</div>
)

function Donut({ percent, color = '#2563eb' }: { percent: number; color?: string }) {
  const clamped = Math.max(0, Math.min(100, percent))
  const r = 36
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - clamped / 100)
  return (
    <svg width={90} height={90} viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={r} stroke="#e5e7eb" strokeWidth="12" fill="none" />
      <circle cx="50" cy="50" r={r} stroke={color} strokeWidth="12" fill="none" strokeDasharray={`${circ}`} strokeDashoffset={offset} strokeLinecap="round" transform="rotate(-90 50 50)" />
      <text x="50" y="53" textAnchor="middle" fontSize="16" fontWeight={600} fill="#111827">{clamped}%</text>
    </svg>
  )
}

function MiniLine({ points, color = '#16a34a' }: { points: number[]; color?: string }) {
  const max = Math.max(1, ...points)
  const path = points.map((v, i) => `${(i / (points.length - 1)) * 100},${100 - (v / max) * 100}`).join(' ')
  return (
    <svg width="100%" height={60} viewBox="0 0 100 100" preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="2" points={path} />
    </svg>
  )
}

function Heatmap({ values }: { values: number[] }) {
  const cols = 14
  const rows = Math.ceil(values.length / cols)
  const max = Math.max(1, ...values)
  const size = 12
  const gap = 3
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, ${size}px)`, gap }}>
      {Array.from({ length: rows * cols }).map((_, i) => {
        const v = values[i] ?? 0
        const intensity = v / max
        const color = `rgba(34,197,94,${0.15 + 0.75 * intensity})`
        return <div key={i} style={{ width: size, height: size, borderRadius: 3, background: v ? color : '#f3f4f6' }} />
      })}
    </div>
  )
}

export function App() {
  const [events, setEvents] = useState<TrackerEvent[]>([])
  const [settings, setSettings] = useState<Settings>({ openaiKey: '', geminiKey: '', model: 'openai:gpt-4o-mini', screenshotEnabled: false })
  const [chatInput, setChatInput] = useState('Summarize my current task and suggest next actions.')
  const [chatLog, setChatLog] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [tab, setTab] = useState<'dashboard' | 'analytics' | 'sessions' | 'assistant' | 'settings' | 'profile'>('dashboard')
  const [latestShot, setLatestShot] = useState<{ ts: number; dataUrl: string } | null>(null)
  const [tracking, setTracking] = useState<boolean>(false)
  const isBridgeAvailable = typeof (window as any).focuslens !== 'undefined'

  useEffect(() => {
    let unsub: (() => void) | undefined
    let unsubShot: (() => void) | undefined
    if (window.focuslens?.onTrackerUpdate) {
      unsub = window.focuslens.onTrackerUpdate((p) => {
        setEvents((prev) => [...prev.slice(-99), p])
      })
    }
    if (window.focuslens?.onScreenshot) {
      unsubShot = window.focuslens.onScreenshot((p: any) => setLatestShot(p))
    }
    window.focuslens?.getSettings?.().then(setSettings)
    window.focuslens?.getTrackingStatus?.().then((s: any) => setTracking(!!s?.enabled))
    return () => { unsub && unsub(); unsubShot && unsubShot() }
  }, [])

  const last = events[events.length - 1]
  const productiveScore = useMemo(() => events.reduce((acc, e) => acc + (e.analysis?.score || 0), 0), [events])
  const productivePct = useMemo(() => {
    if (events.length === 0) return 0
    const prod = events.filter(e => e.analysis.label === 'productive').length
    return Math.round((prod / events.length) * 100)
  }, [events])

  const mockTopApps = useMemo(() => {
    const counts: Record<string, number> = {}
    events.forEach(e => { counts[e.app] = (counts[e.app] || 0) + 1 })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [events])

  const timeOfDaySeries = useMemo(() => {
    const hours = new Array(24).fill(0)
    events.forEach(e => { const h = new Date(e.ts).getHours(); hours[h] += Math.max(0, e.analysis.score) })
    return hours
  }, [events])

  const dayHeatmapVals = useMemo(() => {
    const days = 7 * 14
    const arr = new Array(days).fill(0)
    events.forEach(e => { const idx = Math.floor((Date.now() - e.ts) / (1000 * 60 * 60 * 24)); if (idx >= 0 && idx < arr.length) arr[arr.length - 1 - idx] += Math.max(0, e.analysis.score) })
    return arr
  }, [events])

  const sendChat = async () => {
    const prompt = chatInput.trim()
    if (!prompt) return
    setChatLog((l) => [...l, { role: 'user', content: prompt }])
    setChatInput('')
    const title = last ? `${last.app} — ${last.title}` : 'No active window'
    const res = await window.focuslens.askHelp({ title, visibleText: last?.title })
    setChatLog((l) => [...l, { role: 'assistant', content: res }])
  }

  const saveSettings = async () => { await window.focuslens.setSettings(settings) }

  return (
    <div style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system', color: '#0f172a', background: '#0b1020', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 20px 80px' }}>
        {!isBridgeAvailable && (
          <div style={{ background: '#7c2d12', color: 'white', padding: '8px 12px', borderRadius: 8, marginBottom: 12 }}>
            Running in a regular browser. Open the Electron window to enable tracking.
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg,#60a5fa,#22c55e)' }} />
            <div>
              <div style={{ color: '#e5e7eb', fontWeight: 700, letterSpacing: 0.2 }}>FocusLens</div>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Hackathon productivity + AI assistant</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <nav style={{ display: 'flex', gap: 8, background: '#0d1428', border: '1px solid #1f2937', padding: 4, borderRadius: 999 }}>
              {[
                { id: 'dashboard', label: 'Dashboard' },
                { id: 'analytics', label: 'Analytics' },
                { id: 'sessions', label: 'Sessions' },
                { id: 'assistant', label: 'Assistant' },
                { id: 'settings', label: 'Settings' },
                { id: 'profile', label: 'Profile' },
              ].map(t => (
                <button key={t.id} onClick={() => setTab(t.id as any)}
                  style={{
                    background: tab === (t.id as any) ? '#111827' : 'transparent',
                    color: '#e5e7eb',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: 999,
                    cursor: 'pointer'
                  }}>{t.label}</button>
              ))}
            </nav>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ color: '#cbd5e1', fontSize: 12 }}>Score</div>
              <div style={{ background: '#111827', color: '#e5e7eb', padding: '6px 10px', borderRadius: 8, fontWeight: 700 }}>{productiveScore}</div>
            </div>
          </div>
        </div>

        {tab === 'dashboard' && (
          <Dashboard
            last={last}
            productivePct={productivePct}
            events={events}
            timeOfDaySeries={timeOfDaySeries}
            topApps={mockTopApps as any}
            dayHeatmapVals={dayHeatmapVals}
            badgeColor={badgeColor}
            chatLog={chatLog}
            chatInput={chatInput}
            setChatInput={(v: string) => setChatInput(v)}
            sendChat={sendChat}
            settings={settings}
            setSettings={(s: any) => setSettings(s)}
            saveSettings={saveSettings}
            latestShot={latestShot}
            tracking={tracking}
            onStart={async () => {
              if (!(window as any).focuslens?.startTracking) return alert('Open the Electron window to start tracking.')
              const r = await (window as any).focuslens.startTracking(); setTracking(!!r?.enabled)
            }}
            onStop={async () => {
              if (!(window as any).focuslens?.stopTracking) return
              const r = await (window as any).focuslens.stopTracking(); setTracking(!!r?.enabled)
            }}
          />
        )}

        {tab === 'analytics' && (
          <AnalyticsPage topApps={mockTopApps as any} timeOfDaySeries={timeOfDaySeries} dayHeatmapVals={dayHeatmapVals} />
        )}

        {tab === 'sessions' && (
          <SessionsPage events={events} badgeColor={badgeColor} />
        )}

        {tab === 'assistant' && (
          <AssistantPage chatLog={chatLog} chatInput={chatInput} setChatInput={(v) => setChatInput(v)} sendChat={sendChat} />
        )}

        {tab === 'settings' && (
          <SettingsPage settings={settings} setSettings={(s: any) => setSettings(s)} saveSettings={saveSettings} />
        )}

        {tab === 'profile' && (
          <ProfilePage productivePct={productivePct} />
        )}
      </div>
    </div>
  )
}


