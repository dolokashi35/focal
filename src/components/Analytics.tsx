import React, { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { FocusData } from "../types/ipc";
import "./Dashboard.css";

const Stat: React.FC<{ label: string; value: string; sub?: string; icon?: string }> = ({ label, value, sub, icon = "📊" }) => (
    <div className="card">
        <div className="card-header">
            <h3 className="card-title">{label}</h3>
            <div className="card-icon">{icon}</div>
        </div>
        <div className="score-display">
            <div className="score-circle">
                <div className="score-value">{value}</div>
            </div>
            {sub && <div className="score-label">{sub}</div>}
        </div>
    </div>
);

const Analytics: React.FC = () => {
    const navigate = useNavigate();
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Generate static random data once on mount
    const staticData = useMemo(() => {
        const demoApps = ["Visual Studio Code", "Google Chrome", "Terminal", "Notion", "Slack", "Figma", "Discord"];
        
        // Generate 60 data points for the graph
        const dataPoints: FocusData[] = [];
        let cumulative = 0;
        let lastValue = 50;
        const now = Date.now();
        
        for (let i = 0; i < 60; i++) {
            const delta = (Math.random() - 0.5) * 15;
            const instantaneous = Math.max(0, Math.min(100, lastValue + delta));
            lastValue = instantaneous;
            const switchRate = +(Math.max(0, Math.min(2.5, Math.abs((Math.random() - 0.3) * 2.5)))).toFixed(2);
            const app = demoApps[Math.floor(Math.random() * demoApps.length)];
            const context = instantaneous > 75 ? "deep_work" : instantaneous > 55 ? "learning" : instantaneous > 35 ? "maintenance" : instantaneous > 10 ? "distracted" : "idle";
            cumulative = +(cumulative + instantaneous / 3600).toFixed(2);
            
            dataPoints.push({
                instantaneous,
                cumulative,
                aiInsight: "demo",
                context,
                activeApp: app,
                windowTitle: null,
                url: null,
                switchRate,
                keystrokeRate: 0,
                timestamp: now - (60 - i) * 1000,
            });
        }
        
        // Calculate metrics from the static data
        const oneMin = dataPoints.slice(-10); // last 10 points as 1-minute average
        const threeMin = dataPoints.slice(-30); // last 30 points as 3-minute average
        
        const avg = (arr: FocusData[]) => (arr.length ? arr.reduce((a, b) => a + (b.instantaneous ?? 0), 0) / arr.length : 0);
        
        const appCounts = new Map<string, number>();
        for (const s of threeMin) {
            const key = s.activeApp || "Unknown";
            appCounts.set(key, (appCounts.get(key) || 0) + 1);
        }
        const topApps = Array.from(appCounts.entries())
            .map(([app, count]) => ({ app, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
        
        return {
            dataPoints,
            current: Math.round(dataPoints[dataPoints.length - 1].instantaneous),
            avg1m: Math.round(avg(oneMin)),
            avg3m: Math.round(avg(threeMin)),
            switchRate: +(dataPoints[dataPoints.length - 1].switchRate).toFixed(2),
            topApps,
        };
    }, []);

    const metrics = staticData;

    // Draw static graph
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !staticData.dataPoints.length) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size
        canvas.width = canvas.offsetWidth * window.devicePixelRatio;
        canvas.height = canvas.offsetHeight * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

        // Clear canvas
        ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

        // Get data points
        const dataPoints = staticData.dataPoints;
        if (dataPoints.length < 2) return;

        // Find min/max values
        const values = dataPoints.map(d => d.instantaneous ?? 0);
        const minVal = Math.min(...values);
        const maxVal = Math.max(...values);
        const range = maxVal - minVal || 1;

        // Graph dimensions
        const padding = 20;
        const width = canvas.offsetWidth - padding * 2;
        const height = canvas.offsetHeight - padding * 2;

        // Draw grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = padding + (height / 4) * i;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(padding + width, y);
            ctx.stroke();
        }

        // Draw data line
        ctx.strokeStyle = '#59dcb2';
        ctx.lineWidth = 2;
        ctx.beginPath();

        dataPoints.forEach((point, index) => {
            const x = padding + (width / (dataPoints.length - 1)) * index;
            const normalizedValue = (point.instantaneous ?? 0 - minVal) / range;
            const y = padding + height - (normalizedValue * height);

            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.stroke();

        // Draw data points
        ctx.fillStyle = '#59dcb2';
        dataPoints.forEach((point, index) => {
            const x = padding + (width / (dataPoints.length - 1)) * index;
            const normalizedValue = (point.instantaneous ?? 0 - minVal) / range;
            const y = padding + height - (normalizedValue * height);

            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fill();
        });

        // Draw labels
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '12px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`Max: ${maxVal.toFixed(1)}`, padding, padding + 15);
        ctx.fillText(`Min: ${minVal.toFixed(1)}`, padding, padding + 30);
        ctx.fillText(`Current: ${(dataPoints[dataPoints.length - 1]?.instantaneous ?? 0).toFixed(1)}`, padding, padding + 45);

    }, [staticData]);

    return (
        <div className="app-container">
            {/* Sidebar (same as Dashboard) */}
            <div className="sidebar">
                <div className="logo">
                    <div className="logo-icon">🧠</div>
                    <div className="logo-text">FocusAI</div>
                </div>
                <nav className="nav">
                    <div className="nav-section">
                        <div className="nav-title">Main</div>
                        <div className="nav-item" onClick={() => navigate("/") }>
                            <div className="nav-icon">📊</div>
                            <div className="nav-label">Dashboard</div>
                        </div>
                        <div className="nav-item" onClick={() => navigate("/garden") }>
                            <div className="nav-icon">🌱</div>
                            <div className="nav-label">Garden</div>
                        </div>
                        <div className="nav-item active">
                            <div className="nav-icon">📈</div>
                            <div className="nav-label">Analytics</div>
                        </div>
                        <div className="nav-item" onClick={() => navigate("/leaderboard") }>
                            <div className="nav-icon">🏆</div>
                            <div className="nav-label">Leaderboard</div>
                        </div>
                    </div>
                </nav>
            </div>

            {/* Content */}
            <div className="main-content">
                <h1 className="session-title">Analytics</h1>
                <div className="cards-grid">
                    <Stat label="Current" value={`${metrics.current}`} sub="Instantaneous focus" icon="⚡" />
                    <Stat label="1 minute" value={`${metrics.avg1m}`} sub="Rolling average" icon="🕐" />
                    <Stat label="3 minutes" value={`${metrics.avg3m}`} sub="Rolling average" icon="⏱️" />
                    <Stat label="Switch rate" value={`${metrics.switchRate}`} sub="per minute" icon="🔁" />

                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Top Apps (last 3 min)</h3>
                            <div className="card-icon">💻</div>
                        </div>
                        <ol className="leaderboard-list">
                            {metrics.topApps.length === 0 ? (
                                <div className="leaderboard-empty">No activity yet</div>
                            ) : (
                                metrics.topApps.map((t) => (
                                    <li key={t.app} className="leaderboard-item">
                                        <div className="leaderboard-user">{t.app}</div>
                                        <div className="leaderboard-score">{t.count}</div>
                                    </li>
                                ))
                            )}
                        </ol>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Focus Score Trend</h3>
                            <div className="card-icon">📈</div>
                        </div>
                        <div style={{ padding: '16px' }}>
                            <canvas 
                                ref={canvasRef}
                                style={{ 
                                    width: '100%', 
                                    height: '200px',
                                    background: 'rgba(0, 0, 0, 0.1)',
                                    borderRadius: '8px'
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Analytics;


