import React from 'react'

export const Card: React.FC<{ title?: string; right?: React.ReactNode; style?: React.CSSProperties }>
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

export const SectionTitle: React.FC<{ label: string }>= ({ label }) => (
  <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.6, margin: '16px 0 8px' }}>{label}</div>
)

export function Donut({ percent, color = '#2563eb' }: { percent: number; color?: string }) {
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

export function MiniLine({ points, color = '#16a34a' }: { points: number[]; color?: string }) {
  const max = Math.max(1, ...points)
  const path = points.map((v, i) => `${(i / (points.length - 1)) * 100},${100 - (v / max) * 100}`).join(' ')
  return (
    <svg width="100%" height={60} viewBox="0 0 100 100" preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="2" points={path} />
    </svg>
  )
}

export function Heatmap({ values }: { values: number[] }) {
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





