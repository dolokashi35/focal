import React from 'react'
import { Card } from '../components/UI'

export function Assistant({ chatLog, chatInput, setChatInput, sendChat }: {
  chatLog: { role: 'user' | 'assistant'; content: string }[]
  chatInput: string
  setChatInput: (v: string) => void
  sendChat: () => void
}) {
  return (
    <Card title="🪄 Productivity Assistant Chat" style={{ background: '#0d1428', border: '1px solid #1f2937' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ maxHeight: 420, overflow: 'auto', border: '1px solid #111827', borderRadius: 8, padding: 8, background: '#0b1020' }}>
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
  )
}





