import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Debug.css";

interface DebugData {
	instantaneous: number;
	cumulative: number;
	aiInsight: string;
	context: string;
	activeApp: string | null;
	windowTitle: string | null;
	url: string | null;
	switchRate: number;
	keystrokeRate: number;
	keystrokeCount: number;
	baseScore?: number;
	aiMultiplier?: number;
	focusRatio?: number;
	timestamp: number;
}

const Debug = () => {
	const navigate = useNavigate();
	const [debugData, setDebugData] = useState<DebugData | null>(null);
	const [updateCount, setUpdateCount] = useState<number>(0);
	const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
	const [updateStream, setUpdateStream] = useState<DebugData[]>([]);

	useEffect(() => {
		const ipcRenderer = (window as any).require?.("electron")?.ipcRenderer;
		if (!ipcRenderer) return;

		const handleFocusUpdate = (_event: any, data: DebugData) => {
			console.log("Debug console received focus update:", data);
			setDebugData(data);
			setUpdateCount((prev) => prev + 1);
			
			// Add to update stream (keep last 100 updates)
			setUpdateStream((prev) => {
				const newStream = [data, ...prev];
				return newStream.slice(0, 100);
			});
		};

		ipcRenderer.on("focus-update", handleFocusUpdate);

		return () => {
			ipcRenderer.removeListener("focus-update", handleFocusUpdate);
		};
	}, []);

	useEffect(() => {
		if (!autoRefresh) return;

		// Request debug data periodically to keep the stream updated
		const interval = setInterval(() => {
			const ipcRenderer = (window as any).require?.("electron")?.ipcRenderer;
			if (ipcRenderer) {
				ipcRenderer.send("request-debug-data");
			}
		}, 3000); // Request every 3 seconds

		// Also request immediately
		const ipcRenderer = (window as any).require?.("electron")?.ipcRenderer;
		if (ipcRenderer) {
			ipcRenderer.send("request-debug-data");
		}

		return () => clearInterval(interval);
	}, [autoRefresh]);

	return (
		<div className="debug-container">
			<div className="debug-sidebar">
				<div className="debug-header">
					<button className="debug-back-btn" onClick={() => navigate("/")}>
						← Back to Dashboard
					</button>
					<h1 className="debug-title">Debug Console</h1>
					<p className="debug-subtitle">Real-time FocusAI Metrics</p>
				</div>

				<div className="debug-section">
					<div className="debug-section-title">Status</div>
					<div className="debug-item">
						<span className="debug-label">Updates Received</span>
						<span className="debug-value number">{updateCount}</span>
					</div>
					<div className="debug-item">
						<span className="debug-label">Auto Refresh</span>
						<span className="debug-value boolean">{autoRefresh ? "On" : "Off"}</span>
					</div>
					<div className="debug-item">
						<span className="debug-label">Last Update</span>
						<span className="debug-value string">
							{debugData ? new Date(debugData.timestamp).toLocaleTimeString() : "--"}
						</span>
					</div>
				</div>

				<div className="debug-section">
					<div className="debug-section-title">Activity Metrics</div>
					<div className="debug-item">
						<span className="debug-label">Keystroke Rate</span>
						<span className="debug-value number">
							{debugData ? `${debugData.keystrokeRate.toFixed(2)}/min` : "--"}
						</span>
					</div>
					<div className="debug-item">
						<span className="debug-label">Total Keystrokes</span>
						<span className="debug-value number">
							{debugData ? debugData.keystrokeCount : "--"}
						</span>
					</div>
					<div className="debug-item">
						<span className="debug-label">App Switch Rate</span>
						<span className="debug-value number">
							{debugData ? `${debugData.switchRate.toFixed(2)}/min` : "--"}
						</span>
					</div>
					<div className="debug-item">
						<span className="debug-label">Focus Ratio</span>
						<span className="debug-value number">
							{debugData?.focusRatio ? `${(debugData.focusRatio * 100).toFixed(1)}%` : "--"}
						</span>
					</div>
				</div>

				<div className="debug-section">
					<div className="debug-section-title">Scores</div>
					<div className="debug-item">
						<span className="debug-label">Instantaneous</span>
						<span className="debug-value number">
							{debugData ? debugData.instantaneous.toFixed(2) : "--"}
						</span>
					</div>
					<div className="debug-item">
						<span className="debug-label">Cumulative</span>
						<span className="debug-value number">{debugData ? debugData.cumulative.toFixed(2) : "--"}</span>
					</div>
					{debugData?.baseScore !== undefined && (
						<div className="debug-item">
							<span className="debug-label">Base Score</span>
							<span className="debug-value number">{debugData.baseScore.toFixed(2)}</span>
						</div>
					)}
					{debugData?.aiMultiplier !== undefined && (
						<div className="debug-item">
							<span className="debug-label">AI Multiplier</span>
							<span className="debug-value number">{debugData.aiMultiplier.toFixed(2)}</span>
						</div>
					)}
				</div>

				<div className="debug-section">
					<div className="debug-section-title">Controls</div>
					<button className="debug-btn debug-btn-primary" onClick={() => setAutoRefresh(!autoRefresh)}>
						{autoRefresh ? "Pause" : "Resume"} Auto-Refresh
					</button>
					<button
						className="debug-btn debug-btn-secondary"
						onClick={() => {
							const ipcRenderer = (window as any).require?.("electron")?.ipcRenderer;
							if (!ipcRenderer) return;
							console.log("Debug console requesting debug data...");
							ipcRenderer.send("request-debug-data");
						}}
					>
						Refresh Now
					</button>
					<button
						className="debug-btn debug-btn-primary"
						onClick={() => {
							const ipcRenderer = (window as any).require?.("electron")?.ipcRenderer;
							if (!ipcRenderer) return;
							console.log("Checking accessibility permissions...");
							ipcRenderer.send("check-permissions");
						}}
					>
						Check Permissions
					</button>
					<button
						className="debug-btn debug-btn-secondary"
						onClick={() => {
							const ipcRenderer = (window as any).require?.("electron")?.ipcRenderer;
							if (!ipcRenderer) return;
							console.log("Extracting metadata now...");
							ipcRenderer.send("extract-metadata");
						}}
					>
						Extract Metadata
					</button>
				</div>
			</div>

			<div className="debug-main">
				<div className="debug-tabs">
					<div className="debug-tab active">Live Stream</div>
					<div className="debug-tab">Current Data</div>
					<div className="debug-tab">Statistics</div>
				</div>

				<div className="debug-content">
					{updateStream.length === 0 ? (
						<div className="debug-placeholder">
							<div className="debug-placeholder-icon">🔍</div>
							<div className="debug-placeholder-text">Waiting for debug data...</div>
							<div className="debug-placeholder-hint">Start a focus session to see live metrics</div>
						</div>
					) : (
						<div className="debug-stream-container">
							<div className="debug-stream-header">
								<div className="debug-stream-title">Live Focus Updates</div>
								<div className="debug-stream-count">{updateStream.length} updates</div>
							</div>
							<div className="debug-stream">
								{updateStream.map((update, index) => (
									<div key={`${update.timestamp}-${index}`} className="debug-stream-item">
										<div className="debug-stream-timestamp">
											{new Date(update.timestamp).toLocaleTimeString()}
										</div>
										<div className="debug-stream-data">
											<div className="debug-stream-row">
												<span className="debug-stream-label">App:</span>
												<span className="debug-stream-value">{update.activeApp || "—"}</span>
												<span className="debug-stream-label">Score:</span>
												<span className="debug-stream-value score">{update.instantaneous.toFixed(2)}</span>
											</div>
											<div className="debug-stream-row">
												<span className="debug-stream-label">Title:</span>
												<span className="debug-stream-value title">{update.windowTitle || "—"}</span>
											</div>
											{update.url && (
												<div className="debug-stream-row">
													<span className="debug-stream-label">URL:</span>
													<span className="debug-stream-value url">{update.url}</span>
												</div>
											)}
											<div className="debug-stream-row">
												<span className="debug-stream-label">Context:</span>
												<span className="debug-stream-value context">{update.context}</span>
												<span className="debug-stream-label">Insight:</span>
												<span className="debug-stream-value insight">{update.aiInsight}</span>
											</div>
											<div className="debug-stream-row metrics">
												<span className="debug-stream-label">Keystroke Rate:</span>
												<span className="debug-stream-value">{update.keystrokeRate.toFixed(2)}/min</span>
												<span className="debug-stream-label">Total Keys:</span>
												<span className="debug-stream-value">{update.keystrokeCount}</span>
											</div>
											<div className="debug-stream-row metrics">
												<span className="debug-stream-label">Switch Rate:</span>
												<span className="debug-stream-value">{update.switchRate.toFixed(2)}/min</span>
												<span className="debug-stream-label">Focus Ratio:</span>
												<span className="debug-stream-value">{update.focusRatio ? `${(update.focusRatio * 100).toFixed(1)}%` : "--"}</span>
											</div>
											<div className="debug-stream-row metrics">
												<span className="debug-stream-metric">
													Cumulative: {update.cumulative.toFixed(2)}
												</span>
											</div>
										</div>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default Debug;
