import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { FocusData } from "../types/ipc";
import { fetchAllScores, fetchScore } from "../utils/database";
import "./Dashboard.css";
import "./Garden.css"; // Use Garden theme variables and surfaces

interface Activity {
	app: string;
	context: string;
	url: string;
	timestamp: Date;
	type: string;
}

interface DashboardProps {
	onSignOut?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onSignOut }) => {
	const navigate = useNavigate();
	const [instantaneousScore, setInstantaneousScore] = useState<number>(0);
	const [cumulativeScore, setCumulativeScore] = useState<number>(0);
	const [instantaneousContext, setInstantaneousContext] = useState<string>("Calculating...");
	const [cumulativeContext, setCumulativeContext] = useState<string>("Building momentum...");
	// Garden UI removed from dashboard; keep future-proofed variables commented out
	// const [gardenPlant, setGardenPlant] = useState<string>("🌱");
	// const [gardenName, setGardenName] = useState<string>("Seedling");
	const [activityHistory, setActivityHistory] = useState<Activity[]>([]);
	const [insights, setInsights] = useState<Array<{ text: string; timestamp: number }>>([]);
	const [sessionActive, setSessionActive] = useState<boolean>(false);
    const [, setSessionStartTime] = useState<number | null>(null);
	const [sessionDuration, setSessionDuration] = useState<string>("00:00:00");
    const sessionStartRef = useRef<number | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
	const [leaderboard, setLeaderboard] = useState<Array<{ userId: string; score: number; username?: string }>>([]);
	const [loadingLeaderboard, setLoadingLeaderboard] = useState<boolean>(false);
	const [leaderboardError, setLeaderboardError] = useState<string | null>(null);

	const gardenLevels = ["🌱", "🌿", "🌳", "🌸", "🌺", "🌻", "🌷", "🌹"];
	const gardenNames = [
		"Seedling",
		"Sprout",
		"Sapling",
		"Budding",
		"Blooming",
		"Flowering",
		"Thriving",
		"Masterpiece",
	];

	const updateScoreCircle = (circleId: string, score: number) => {
		const circle = document.getElementById(circleId);
		if (!circle) return;

		const percentage = Math.min(score, 100);
		const degrees = (percentage / 100) * 360;

		circle.style.background = `conic-gradient(
      var(--success-gradient) ${degrees}deg,
      var(--glass-border) ${degrees}deg
    )`;
	};

	const updateDashboard = useCallback(
		(data: FocusData) => {
			console.log("Dashboard update:", data);

			// Update instantaneous score
			setInstantaneousScore(data.instantaneous);
			setInstantaneousContext(data.context || "Calculating...");
			updateScoreCircle("instantaneousCircle", data.instantaneous);

			// Update cumulative score
			setCumulativeScore(data.cumulative);
			setCumulativeContext("Session average");
			updateScoreCircle("cumulativeCircle", data.cumulative);

			// Garden UI removed from dashboard

			// Update activity feed
			const activity: Activity = {
				app: data.activeApp || "Unknown",
				context: data.context,
				url: data.url || "",
				timestamp: new Date(data.timestamp),
				type: getActivityType(data.activeApp || "", data.url || ""),
			};

			setActivityHistory((prev) => {
				const newHistory = [activity, ...prev];
				return newHistory.slice(0, 10);
			});

			// Update AI insights
			setInsights((prev) => {
				const newInsights = [
					{
						text: data.aiInsight || "Analyzing your productivity patterns...",
						timestamp: data.timestamp,
					},
					...prev,
				];
				return newInsights.slice(0, 5);
			});
		},
		[gardenLevels, gardenNames]
	);

	useEffect(() => {
		const ipcRenderer = (window as any).require?.("electron")?.ipcRenderer;
		if (!ipcRenderer) return;

		const handleFocusUpdate = (_event: any, data: FocusData) => {
			updateDashboard(data);
		};

		ipcRenderer.on("focus-update", handleFocusUpdate);

		return () => {
			ipcRenderer.removeListener("focus-update", handleFocusUpdate);
		};
	}, [updateDashboard]);

	// Fetch all-time total score from DB on mount (and update circle)
	useEffect(() => {
		let isMounted = true;
		const loadDbTotal = async () => {
			try {
				const total = await fetchScore();
				if (isMounted && typeof total === "number") {
					setCumulativeScore(total);
					setCumulativeContext("All-time total");
					updateScoreCircle("cumulativeCircle", total);
				}
			} catch (_err) {
				// non-fatal
			}
		};
		loadDbTotal();
		return () => {
			isMounted = false;
		};
	}, []);

	// When session stops, refresh DB total to ensure UI matches persisted value
	useEffect(() => {
		if (!sessionActive) {
			(async () => {
				try {
					const total = await fetchScore();
					if (typeof total === "number") {
						setCumulativeScore(total);
						setCumulativeContext("All-time total");
						updateScoreCircle("cumulativeCircle", total);
					}
				} catch (_err) {
					// ignore
				}
			})();
		}
	}, [sessionActive]);

    // Drive the timer from a stable ref to avoid flicker/jumps on state updates
    useEffect(() => {
        if (!sessionActive) return;
        if (!sessionStartRef.current) return;

        // Clear any prior interval
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            const start = sessionStartRef.current as number;
            const duration = Date.now() - start;
            const hours = Math.floor(duration / 3600000);
            const minutes = Math.floor((duration % 3600000) / 60000);
            const seconds = Math.floor((duration % 60000) / 1000);

            const timeString = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds
                .toString()
                .padStart(2, "0")}`;
            setSessionDuration(timeString);
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
        };
    }, [sessionActive]);

    const startSession = () => {
		const ipcRenderer = (window as any).require?.("electron")?.ipcRenderer;
		if (!ipcRenderer) return;

        const now = Date.now();
        sessionStartRef.current = now;
        setSessionStartTime(now);
        setSessionDuration("00:00:00");
        setSessionActive(true);
		ipcRenderer.send("start-session");
		console.log("Focus session started");
	};

    const stopSession = () => {
		const ipcRenderer = (window as any).require?.("electron")?.ipcRenderer;
		if (!ipcRenderer) return;

		setSessionActive(false);
		setSessionStartTime(null);
        sessionStartRef.current = null;
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
		ipcRenderer.send("stop-session");
		console.log("Focus session stopped");
	};

	const trimmedUserId = useCallback((uid: string) => {
		if (!uid) return "unknown";
		const start = uid.slice(0, 6);
		const end = uid.slice(-4);
		return `${start}...${end}`;
	}, []);

	const refreshLeaderboard = useCallback(async () => {
		setLoadingLeaderboard(true);
		setLeaderboardError(null);
		try {
			const scores = await fetchAllScores();
			if (scores) {
				// Ensure sorted desc by score
				scores.sort((a, b) => b.score - a.score);
				setLeaderboard(scores);
			}
		} catch (e: any) {
			setLeaderboardError("Failed to load leaderboard");
		} finally {
			setLoadingLeaderboard(false);
		}
	}, []);

	useEffect(() => {
		// Load on mount
		refreshLeaderboard();
	}, [refreshLeaderboard]);

	const getActivityType = (app: string, url: string) => {
		const appLower = app.toLowerCase();
		const urlLower = url.toLowerCase();

		if (appLower.includes("cursor") || appLower.includes("code") || appLower.includes("vs code")) {
			return "coding";
		} else if (appLower.includes("chrome") || appLower.includes("safari")) {
			if (
				urlLower.includes("github.com") ||
				urlLower.includes("stackoverflow.com") ||
				urlLower.includes("docs.")
			) {
				return "coding";
			} else if (
				urlLower.includes("youtube.com") ||
				urlLower.includes("netflix.com") ||
				urlLower.includes("twitch.tv")
			) {
				return "media";
			} else if (urlLower.includes("gmail.com") || urlLower.includes("outlook.com")) {
				return "communication";
			} else if (urlLower.includes("chatgpt.com") || urlLower.includes("claude.ai")) {
				return "ai-tools";
			}
			return "browsing";
		} else if (appLower.includes("notion") || appLower.includes("obsidian")) {
			return "productivity";
		} else if (appLower.includes("discord") || appLower.includes("slack")) {
			return "communication";
		} else if (appLower.includes("spotify") || appLower.includes("music")) {
			return "media";
		}
		return "other";
	};

	const getActivityIcon = (type: string) => {
		const icons: Record<string, string> = {
			coding: "💻",
			media: "🎵",
			communication: "💬",
			"ai-tools": "🤖",
			browsing: "🌐",
			productivity: "📝",
			other: "⚙️",
		};
		return icons[type] || "⚙️";
	};

	const getActivityGradient = (type: string) => {
		const gradients: Record<string, string> = {
			coding: "var(--success-gradient)",
			media: "var(--secondary-gradient)",
			communication: "var(--warning-gradient)",
			"ai-tools": "var(--primary-gradient)",
			browsing: "var(--glass-border)",
			productivity: "var(--success-gradient)",
			other: "var(--glass-border)",
		};
		return gradients[type] || "var(--glass-border)";
	};

	const getDomainFromUrl = (url: string) => {
		try {
			const domain = new URL(url).hostname;
			return domain.replace("www.", "");
		} catch (e) {
			return url;
		}
	};

	const formatTime = (timestamp: Date) => {
		const now = new Date();
		const diff = now.getTime() - timestamp.getTime();
		const minutes = Math.floor(diff / 60000);

		if (minutes < 1) return "Just now";
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h ago`;
		return timestamp.toLocaleDateString();
	};

	return (
		<div className="app-container">
			{/* Premium Sidebar */}
			<div className="sidebar">
				<div className="logo">
					<div className="logo-icon">🧠</div>
					<div className="logo-text">FocusAI</div>
				</div>

				<nav className="nav">
					<div className="nav-section">
						<div className="nav-title">Main</div>
						<div className="nav-item active">
							<div className="nav-icon">📊</div>
							<div className="nav-label">Dashboard</div>
						</div>
						<div className="nav-item" onClick={() => navigate("/garden")}>
							<div className="nav-icon">🌱</div>
							<div className="nav-label">Garden</div>
						</div>
                        <div className="nav-item" onClick={() => navigate("/analytics") }>
                            <div className="nav-icon">📈</div>
                            <div className="nav-label">Analytics</div>
                        </div>
						<div className="nav-item" onClick={() => navigate("/leaderboard")}>
							<div className="nav-icon">🏆</div>
							<div className="nav-label">Leaderboard</div>
						</div>
					</div>

					{/* Sidebar footer */}
					<div className="sidebar-footer">
						{onSignOut && (
							<button className="btn btn-danger sidebar-signout" onClick={onSignOut}>
								Sign Out
							</button>
						)}
					</div>
				</nav>
			</div>

			{/* Main Content */}
			<div className="main-content">
				<h1 className="session-title">Session Control</h1>

				{/* Hero Banner */}
				<div className={`hero-banner ${sessionActive ? "hero-active" : ""}`}>
					<div className="hero-content">
                        <h1 className="hero-title">{sessionActive ? sessionDuration : "00:00:00"}</h1>
						<div className="hero-actions">
							{!sessionActive ? (
								<button className="btn-hero btn-hero-primary" onClick={startSession}>
									Start Focus Session
								</button>
							) : (
								<button className="btn-hero btn-hero-danger" onClick={stopSession}>
									Stop Session
								</button>
							)}
						</div>
                        {/* Timer now shown in the title; keep status minimal */}
					</div>
					<div className="hero-glow" />
				</div>

				{/* Premium Cards Grid */}
				<div className="cards-grid">
					{/* Instantaneous Score Card */}
					<div className={`card score-card ${sessionActive ? "session-active" : ""}`}>
						<div className="card-header">
							<h3 className="card-title">
								Instantaneous Focus
								{sessionActive && <span className="session-indicator">●</span>}
							</h3>
							<div className="card-icon">⚡</div>
						</div>
						<div className="score-display">
							<div className="score-circle" id="instantaneousCircle">
								<div className="score-value">{instantaneousScore.toFixed(0)}</div>
								{sessionActive && <div className="score-pulse"></div>}
							</div>
							<div>
								<div className="score-label">{sessionActive ? "Live Score" : "Current Score"}</div>
								<div className="score-label">{instantaneousContext}</div>
								{sessionActive && (
									<div className="score-status">
										<span className="status-dot"></span>
										Updating in real-time
									</div>
								)}
							</div>
						</div>
					</div>

					{/* Cumulative Score Card */}
					<div className={`card score-card ${sessionActive ? "session-active" : ""}`}>
						<div className="card-header">
							<h3 className="card-title">
								Cumulative Progress
								{sessionActive && <span className="session-indicator">●</span>}
							</h3>
							<div className="card-icon">📈</div>
						</div>
						<div className="score-display">
							<div className="score-circle" id="cumulativeCircle">
								<div className="score-value">{cumulativeScore.toFixed(0)}</div>
								{sessionActive && <div className="score-pulse"></div>}
							</div>
							<div>
								<div className="score-label">{sessionActive ? "Live Total" : "All-time Total"}</div>
								<div className="score-label">{cumulativeContext}</div>
								{sessionActive && (
									<div className="score-status">
										<span className="status-dot"></span>
										Growing with focus
									</div>
								)}
							</div>
						</div>
					</div>

					{/* Focus Garden card removed per request */}

					{/* Activity Feed Card */}
					<div className="card activity-card">
						<div className="card-header">
							<h3 className="card-title">Recent Activity</h3>
							<div className="card-icon">🔄</div>
						</div>
						<div className="activity-feed">
							{activityHistory.length === 0 ? (
								<div className="activity-item">
									<div className="activity-icon" style={{ background: "var(--success-gradient)" }}>
										💻
									</div>
									<div className="activity-content">
										<div className="activity-text">Starting FocusAI session</div>
										<div className="activity-time">Just now</div>
									</div>
								</div>
							) : (
								activityHistory.map((activity, index) => (
									<div key={index} className="activity-item">
										<div
											className="activity-icon"
											style={{ background: getActivityGradient(activity.type) }}
										>
											{getActivityIcon(activity.type)}
										</div>
										<div className="activity-content">
											<div className="activity-text">
												{activity.context || `Using ${activity.app}`}
												{activity.url && ` - ${getDomainFromUrl(activity.url)}`}
											</div>
											<div className="activity-time">{formatTime(activity.timestamp)}</div>
										</div>
									</div>
								))
							)}
						</div>
					</div>

					{/* AI Insights Card */}
					<div className="card insights-card">
						<div className="card-header">
							<h3 className="card-title">AI Insights</h3>
							<div className="card-icon">🤖</div>
						</div>
						<div>
							{insights.length === 0 ? (
								<div className="insight-item">
									<div className="insight-text">
										Welcome to FocusAI! I'm analyzing your productivity patterns...
									</div>
									<div className="insight-timestamp">Initializing</div>
								</div>
							) : (
								insights.map((insight, index) => (
									<div key={index} className="insight-item">
										<div className="insight-text">{insight.text}</div>
										<div className="insight-timestamp">
											{new Date(insight.timestamp).toLocaleTimeString()}
										</div>
									</div>
								))
							)}
						</div>
					</div>

					{/* Leaderboard Card */}
					<div className="card leaderboard-card">
						<div className="card-header">
							<h3 className="card-title">Leaderboard</h3>
							<div className="card-icon">🏆</div>
						</div>
						<div className="leaderboard">
							{loadingLeaderboard ? (
								<div className="leaderboard-loading">Loading leaderboard...</div>
							) : leaderboardError ? (
								<div className="leaderboard-error">{leaderboardError}</div>
							) : leaderboard.length === 0 ? (
								<div className="leaderboard-empty">No scores yet</div>
							) : (
								<ol className="leaderboard-list">
									{leaderboard.map((entry, index) => (
										<li key={`${entry.userId}-${index}`} className="leaderboard-item">
											<div className="leaderboard-rank">{index + 1}</div>
											<div className="leaderboard-user">
												{entry.username || trimmedUserId(entry.userId)}
											</div>
											<div className="leaderboard-score">{entry.score}</div>
										</li>
									))}
								</ol>
							)}
							<div className="leaderboard-actions">
								<button className="btn btn-secondary" onClick={refreshLeaderboard}>
									Refresh
								</button>
							</div>
						</div>
					</div>

					{/* Removed separate Session Control card; controls moved to hero */}
				</div>
			</div>
		</div>
	);
};

export default Dashboard;
