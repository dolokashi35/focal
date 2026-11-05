import React from 'react'
import { Card, SectionTitle, Donut, MiniLine, Heatmap } from '../components/UI'

export function Dashboard({
  last,
  productivePct,
  events,
  timeOfDaySeries,
  topApps,
  dayHeatmapVals,
  badgeColor,
  chatLog,
  chatInput,
  setChatInput,
  sendChat,
  settings,
  setSettings,
  saveSettings,
  latestShot,
  tracking,
  onStart,
  onStop,
}: {
  last: any
  productivePct: number
  events: any[]
  timeOfDaySeries: number[]
  topApps: [string, number][]
  dayHeatmapVals: number[]
  badgeColor: (s: string) => string
  chatLog: { role: 'user' | 'assistant'; content: string }[]
  chatInput: string
  setChatInput: (v: string) => void
  sendChat: () => void
  settings: { openaiKey: string; geminiKey: string; model: string; screenshotEnabled: boolean }
  setSettings: (s: any) => void
  saveSettings: () => void
  latestShot?: { ts: number; dataUrl: string } | null
  tracking: boolean
  onStart: () => void
  onStop: () => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
      <div style={{ display: 'grid', gap: 16 }}>
        <Card style={{ background: 'linear-gradient(180deg,#0f172a,#0b1020)', border: '1px solid #1f2937', position: 'relative' }}
          right={<div style={{ background: badgeColor(last?.analysis?.label || 'neutral'), color: 'white', padding: '6px 10px', borderRadius: 999 }}>{last?.analysis?.label || 'neutral'}</div>}>
          <SectionTitle label="Current session" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#e5e7eb' }}>
            <div>
              <div style={{ fontSize: 13, color: '#94a3b8' }}>Active</div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{last ? last.app : 'Waiting…'}</div>
              <div style={{ color: '#cbd5e1', maxWidth: 720, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{last?.title}</div>
            </div>
            <Donut percent={productivePct} color="#22c55e" />
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={onStart} disabled={tracking} style={{ background: tracking ? '#374151' : '#22c55e', color: tracking ? '#9ca3af' : '#0b1020', padding: '8px 12px', borderRadius: 8, border: 'none', cursor: tracking ? 'not-allowed' : 'pointer' }}>
              {tracking ? 'Session Running' : 'Start Study Session'}
            </button>
            <button onClick={onStop} disabled={!tracking} style={{ background: '#111827', color: 'white', padding: '8px 12px', borderRadius: 8, border: '1px solid #1f2937', opacity: tracking ? 1 : 0.6, cursor: tracking ? 'pointer' : 'not-allowed' }}>Stop</button>
          </div>
          {latestShot?.dataUrl && (
            <div style={{ position: 'absolute', right: 16, bottom: 16, border: '1px solid #1f2937', borderRadius: 8, overflow: 'hidden' }}>
              <img src={latestShot.dataUrl} alt="recent screen" style={{ width: 160, height: 90, objectFit: 'cover', display: 'block' }} />
            </div>
          )}
        </Card>

        <Card title="Focus Analytics" style={{ background: '#0d1428', border: '1px solid #1f2937' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <SectionTitle label="Focus % last 24h" />
              <MiniLine points={timeOfDaySeries.map(v => v + 1)} color="#22c55e" />
            </div>
            <div>
              <SectionTitle label="Top apps" />
              <div>
                {topApps.length === 0 && <div style={{ color: '#94a3b8' }}>No data yet</div>}
                {topApps.map(([name, count]) => (
                  <div key={name} style={{ display: 'flex', justifyContent: 'space-between', color: '#e5e7eb', padding: '6px 0', borderBottom: '1px solid #1f2937' }}>
                    <div>{name}</div>
                    <div style={{ color: '#94a3b8' }}>{count}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card title="Session Logs" style={{ background: '#0d1428', border: '1px solid #1f2937' }}>
          <div style={{ maxHeight: 220, overflow: 'auto' }}>
            {events.slice().reverse().map((e, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 140px 1fr 100px', gap: 8, alignItems: 'center', color: '#cbd5e1', padding: '6px 0', borderBottom: '1px solid #111827' }}>
                <div style={{ color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>{new Date(e.ts).toLocaleTimeString()}</div>
                <div style={{ color: '#e5e7eb' }}>{e.app}</div>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
                <div style={{ justifySelf: 'end', color: badgeColor(e.analysis.label) }}>{e.analysis.label}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="AI Insights / Summary" style={{ background: '#0d1428', border: '1px solid #1f2937' }} right={<button onClick={() => setChatInput('Summarize today and suggest improvements.')} style={{ background: '#111827', color: '#e5e7eb', border: '1px solid #1f2937', padding: '6px 10px', borderRadius: 8 }}>Quick prompt</button>}>
          <div style={{ color: '#cbd5e1' }}>You were {productivePct}% focused across the last {events.length} samples. Peak productivity around {timeOfDaySeries.indexOf(Math.max(...timeOfDaySeries))}:00. Consider scheduling deep work during that window.</div>
        </Card>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        <Card title="🧑‍💻 Profile Summary" style={{ background: '#0d1428', border: '1px solid #1f2937' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: 10, background: 'linear-gradient(135deg,#22c55e,#60a5fa)' }} />
            <div>
              <div style={{ color: '#e5e7eb', fontWeight: 700 }}>@you</div>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Level 3 • Rank #128</div>
            </div>
            <div style={{ marginLeft: 'auto', width: 160, height: 8, background: '#111827', borderRadius: 999 }}>
              <div style={{ width: `${Math.min(100, productivePct)}%`, height: '100%', background: 'linear-gradient(90deg,#22c55e,#60a5fa)', borderRadius: 999 }} />
            </div>
          </div>
        </Card>

        <Card title="🎯 Goals" style={{ background: '#0d1428', border: '1px solid #1f2937' }}>
          <div style={{ color: '#e5e7eb', display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>Weekly focus-hour goal</div>
              <div style={{ fontVariantNumeric: 'tabular-nums', color: '#94a3b8' }}>12 / 20h</div>
            </div>
            <div style={{ width: '100%', height: 8, background: '#111827', borderRadius: 999 }}>
              <div style={{ width: '60%', height: '100%', background: '#22c55e', borderRadius: 999 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>Reduce social media time by 30%</div>
              <div style={{ color: '#94a3b8' }}>On track</div>
            </div>
          </div>
        </Card>

        <Card title="🔥 Recent Streaks" style={{ background: '#0d1428', border: '1px solid #1f2937' }}>
          <div style={{ color: '#e5e7eb' }}>5‑day focus streak 🔥 • Badge: Most Productive Evening</div>
        </Card>

        <Card title="📅 Calendar View" style={{ background: '#0d1428', border: '1px solid #1f2937' }}>
          <Heatmap values={dayHeatmapVals} />
        </Card>

        <Card title="🪄 Productivity Assistant Chat" style={{ background: '#0d1428', border: '1px solid #1f2937' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ maxHeight: 180, overflow: 'auto', border: '1px solid #111827', borderRadius: 8, padding: 8, background: '#0b1020' }}>
              {chatLog.length === 0 && <div style={{ color: '#94a3b8' }}>Ask anything about your current context. Example: "Summarize the code in my editor."</div>}
              {chatLog.map((m, i) => (
                <div key={i} style={{ margin: '8px 0', color: m.role === 'assistant' ? '#e5e7eb' : '#cbd5e1' }}>
                  <b style={{ color: '#60a5fa' }}>{m.role === 'assistant' ? 'FocusLens' : 'You'}:</b> <span>{m.content}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Type a prompt…" style={{ flex: 1 }} />
              <button onClick={sendChat} style={{ background: '#2563eb', color: 'white', padding: '8px 12px', borderRadius: 8, border: 'none' }}>Send</button>
            </div>
          </div>
        </Card>

        <Card title="🔔 Reminders & Alerts" style={{ background: '#0d1428', border: '1px solid #1f2937' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#e5e7eb' }}>
            <input type="checkbox" defaultChecked /> Start 2‑hour LeetCode session reminders
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#e5e7eb', marginTop: 6 }}>
            <input type="checkbox" defaultChecked /> Refocus nudge when distracting for 5+ minutes
          </label>
        </Card>

        <Card title="⚙️ Settings / Privacy" style={{ background: '#0d1428', border: '1px solid #1f2937' }}>
          <div style={{ display: 'grid', gap: 8, color: '#e5e7eb' }}>
            <label>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Model</div>
              <select value={settings.model} onChange={(e) => setSettings({ ...settings, model: e.target.value })}>
                <option value="openai:gpt-4o-mini">OpenAI GPT-4o mini</option>
                <option value="gemini:1.5-flash">Gemini 1.5 Flash</option>
              </select>
            </label>
            <label>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>OpenAI API Key</div>
              <input value={settings.openaiKey} onChange={(e) => setSettings({ ...settings, openaiKey: e.target.value })} placeholder="sk-..." style={{ width: '100%' }} />
            </label>
            <label>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Gemini API Key</div>
              <input value={settings.geminiKey} onChange={(e) => setSettings({ ...settings, geminiKey: e.target.value })} placeholder="AIza..." style={{ width: '100%' }} />
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={settings.screenshotEnabled} onChange={(e) => setSettings({ ...settings, screenshotEnabled: e.target.checked })} />
              <span>Enable tiny screenshots (not implemented)</span>
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={saveSettings} style={{ background: '#111827', color: 'white', padding: '8px 12px', borderRadius: 8, border: 'none' }}>Save</button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}


