import React, { useEffect, useState } from 'react'
import { Card } from '../components/UI'

type UserProfile = { username: string; level: number; rank: number; goalHours: number; avatarUrl?: string }

export function ProfilePage({ productivePct }: { productivePct: number }) {
  const [profile, setProfile] = useState<UserProfile>({ username: '@you', level: 3, rank: 128, goalHours: 20, avatarUrl: '' })

  useEffect(() => {
    window.focuslens?.getProfile?.().then((p: any) => p && setProfile(p))
  }, [])

  const save = async () => {
    const next = await window.focuslens?.setProfile?.(profile)
    if (next) setProfile(next)
  }
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card title="Profile" style={{ background: '#0d1428', border: '1px solid #1f2937' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 72, height: 72, borderRadius: 12, background: profile.avatarUrl ? `url(${profile.avatarUrl}) center/cover` : 'linear-gradient(135deg,#22c55e,#60a5fa)' }} />
          <div>
            <div style={{ color: '#e5e7eb', fontWeight: 700, fontSize: 18 }}>{profile.username}</div>
            <div style={{ color: '#94a3b8' }}>Level {profile.level} • Rank #{profile.rank}</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
          <label style={{ color: '#e5e7eb' }}>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Username</div>
            <input value={profile.username} onChange={(e) => setProfile({ ...profile, username: e.target.value })} />
          </label>
          <label style={{ color: '#e5e7eb' }}>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Avatar URL</div>
            <input value={profile.avatarUrl} onChange={(e) => setProfile({ ...profile, avatarUrl: e.target.value })} placeholder="https://..." />
          </label>
          <label style={{ color: '#e5e7eb' }}>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Level</div>
            <input type="number" value={profile.level} onChange={(e) => setProfile({ ...profile, level: Number(e.target.value) })} />
          </label>
          <label style={{ color: '#e5e7eb' }}>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Rank</div>
            <input type="number" value={profile.rank} onChange={(e) => setProfile({ ...profile, rank: Number(e.target.value) })} />
          </label>
          <label style={{ color: '#e5e7eb' }}>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Weekly Focus Goal (hours)</div>
            <input type="number" value={profile.goalHours} onChange={(e) => setProfile({ ...profile, goalHours: Number(e.target.value) })} />
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button onClick={save} style={{ background: '#111827', color: 'white', padding: '8px 12px', borderRadius: 8, border: 'none' }}>Save Profile</button>
        </div>
      </Card>

      <Card title="Achievements & Streaks" style={{ background: '#0d1428', border: '1px solid #1f2937' }}>
        <div style={{ color: '#e5e7eb' }}>5‑day focus streak 🔥 • Badge: Most Productive Evening • Focus {productivePct}%</div>
      </Card>
    </div>
  )
}


