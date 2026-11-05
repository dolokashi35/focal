import React from 'react'
import { Card } from '../components/UI'

export function Sessions({ events, badgeColor }: { events: any[]; badgeColor: (s: string) => string }) {
  return (
    <Card title="Session Logs" style={{ background: '#0d1428', border: '1px solid #1f2937' }}>
      <div style={{ maxHeight: 480, overflow: 'auto' }}>
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
  )
}





