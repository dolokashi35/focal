import React from 'react'
import { Card } from '../components/UI'

export function SettingsPage({ settings, setSettings, saveSettings }: {
  settings: { openaiKey: string; geminiKey: string; model: string; screenshotEnabled: boolean; ingestUrl?: string; ingestEnabled?: boolean }
  setSettings: (s: any) => void
  saveSettings: () => void
}) {
  return (
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
        <div style={{ height: 1, background: '#1f2937', margin: '8px 0' }} />
        <label>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Ingest URL</div>
          <input value={settings.ingestUrl || ''} onChange={(e) => setSettings({ ...settings, ingestUrl: e.target.value })} placeholder="http://localhost:4000/focuslens/ingest" style={{ width: '100%' }} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={!!settings.ingestEnabled} onChange={(e) => setSettings({ ...settings, ingestEnabled: e.target.checked })} />
          <span>Send anonymous activity batches every 30s</span>
        </label>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" defaultChecked /> Refocus nudge when distracted 5+ min
          </label>
          <button onClick={saveSettings} style={{ background: '#111827', color: 'white', padding: '8px 12px', borderRadius: 8, border: 'none' }}>Save</button>
        </div>
      </div>
    </Card>
  )
}


