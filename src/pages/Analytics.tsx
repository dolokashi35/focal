import React from 'react'
import { Card, SectionTitle, MiniLine, Heatmap } from '../components/UI'

export function Analytics({ topApps, timeOfDaySeries, dayHeatmapVals }: { topApps: [string, number][]; timeOfDaySeries: number[]; dayHeatmapVals: number[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
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
      <Card title="📅 Calendar View" style={{ background: '#0d1428', border: '1px solid #1f2937' }}>
        <Heatmap values={dayHeatmapVals} />
      </Card>
    </div>
  )
}





