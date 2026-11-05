import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAllScores } from "../utils/database";
import "./Dashboard.css";
import "./Leaderboard.css";

interface LeaderboardEntry {
	userId: string;
	score: number;
	username?: string;
}

const Leaderboard = () => {
	const navigate = useNavigate();
	const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);

	const trimmedUserId = useCallback((uid: string) => {
		if (!uid) return "unknown";
		const start = uid.slice(0, 6);
		const end = uid.slice(-4);
		return `${start}...${end}`;
	}, []);

	const refresh = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const scores = await fetchAllScores();
			if (scores) {
				scores.sort((a, b) => b.score - a.score);
				setEntries(scores);
			}
		} catch (e: any) {
			setError("Failed to load leaderboard");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		refresh();
	}, [refresh]);

	const topThree = useMemo(() => entries.slice(0, 3), [entries]);
	const rest = useMemo(() => entries.slice(3), [entries]);

	return (
		<div className="main-content">
			<button className="leaderboard-back" onClick={() => navigate("/")}>
				<span aria-hidden="true">←</span>
				<span className="leaderboard-back-text">Dashboard</span>
			</button>
			<div className="leaderboard-page-header">
				<div>
					<h1 className="dashboard-title">Leaderboard</h1>
					<p className="dashboard-subtitle">See how you stack up</p>
				</div>
				<div className="leaderboard-page-actions">
					<button className="btn btn-secondary" onClick={refresh} disabled={loading}>
						{loading ? "Loading..." : "Refresh"}
					</button>
				</div>
			</div>

			{/* Podium */}
			<div className="card leaderboard-podium-card">
				<div className="podium">
					<div className="podium-spot podium-2">
						<div className="podium-rank">🥈</div>
						<div className="podium-user">
							{topThree[1] ? topThree[1].username || trimmedUserId(topThree[1].userId) : "—"}
						</div>
						<div className="podium-score">{topThree[1]?.score ?? "—"}</div>
					</div>
					<div className="podium-spot podium-1">
						<div className="podium-rank">🥇</div>
						<div className="podium-user">
							{topThree[0] ? topThree[0].username || trimmedUserId(topThree[0].userId) : "—"}
						</div>
						<div className="podium-score">{topThree[0]?.score ?? "—"}</div>
					</div>
					<div className="podium-spot podium-3">
						<div className="podium-rank">🥉</div>
						<div className="podium-user">
							{topThree[2] ? topThree[2].username || trimmedUserId(topThree[2].userId) : "—"}
						</div>
						<div className="podium-score">{topThree[2]?.score ?? "—"}</div>
					</div>
				</div>
			</div>

			{/* List for the rest */}
			<div className="card leaderboard-list-card">
				{error ? (
					<div className="leaderboard-error">{error}</div>
				) : rest.length === 0 ? (
					<div className="leaderboard-empty">{loading ? "Loading..." : "No more players yet"}</div>
				) : (
					<ol className="leaderboard-list leaderboard-list--spacious">
						{rest.map((entry, idx) => (
							<li key={`${entry.userId}-${idx}`} className="leaderboard-item">
								<div className="leaderboard-rank">{idx + 4}</div>
								<div className="leaderboard-user">{entry.username || trimmedUserId(entry.userId)}</div>
								<div className="leaderboard-score">{entry.score}</div>
							</li>
						))}
					</ol>
				)}
			</div>
		</div>
	);
};

export default Leaderboard;
