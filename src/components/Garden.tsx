import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Plant } from "../core/index";
import { useGardenGame } from "../hooks/useGardenGame";
import "./Garden.css";
import { GardenGrid } from "./garden/GardenGrid";
import { InventoryToolbar } from "./garden/InventoryToolbar";
import { SeedShop } from "./garden/SeedShop";

const Garden = () => {
	const navigate = useNavigate();
	const { state, isReady, error: gameError, dispatch, seeds, multiplier } = useGardenGame();
	const [isSeedShopOpen, setIsSeedShopOpen] = useState(false);
	const [toast, setToast] = useState<{ message: string; visible: boolean } | null>(null);
	const [shakePlotId, setShakePlotId] = useState<string | null>(null);
	const [overlayPlotId, setOverlayPlotId] = useState<string | null>(null);
	const toastTimerRef = useRef<number | null>(null);
	const toastDismissRef = useRef<number | null>(null);

	// Must be called before any conditional returns (Rules of Hooks)
	useEffect(() => {
		return () => {
			if (toastTimerRef.current) {
				window.clearTimeout(toastTimerRef.current);
				toastTimerRef.current = null;
			}
			if (toastDismissRef.current) {
				window.clearTimeout(toastDismissRef.current);
				toastDismissRef.current = null;
			}
		};
	}, []);

	const hideToast = useCallback(() => {
		if (toastTimerRef.current) {
			window.clearTimeout(toastTimerRef.current);
			toastTimerRef.current = null;
		}
		setToast((current) => {
			if (!current || !current.visible) {
				return current;
			}
			return { ...current, visible: false };
		});
	}, []);

	const showToast = useCallback(
		(message: string) => {
			if (toastTimerRef.current) {
				window.clearTimeout(toastTimerRef.current);
				toastTimerRef.current = null;
			}
			if (toastDismissRef.current) {
				window.clearTimeout(toastDismissRef.current);
				toastDismissRef.current = null;
			}

			setToast({ message, visible: true });
			toastTimerRef.current = window.setTimeout(() => {
				hideToast();
			}, 3000);
		},
		[hideToast]
	);

	useEffect(() => {
		if (!gameError) {
			return;
		}

		showToast(gameError.message);

		let shakeTimer: number | undefined;
		if (gameError.plotId && /occupied/i.test(gameError.message)) {
			setShakePlotId(gameError.plotId);
			shakeTimer = window.setTimeout(() => setShakePlotId(null), 600);
		}

		return () => {
			if (shakeTimer) {
				window.clearTimeout(shakeTimer);
			}
		};
	}, [gameError, showToast]);

	useEffect(() => {
		if (!toast || toast.visible) {
			return;
		}

		toastDismissRef.current = window.setTimeout(() => {
			setToast(null);
			toastDismissRef.current = null;
		}, 220);

		return () => {
			if (toastDismissRef.current) {
				window.clearTimeout(toastDismissRef.current);
				toastDismissRef.current = null;
			}
		};
	}, [toast]);

	const dismissToast = useCallback(() => {
		hideToast();
	}, [hideToast]);

	const handleSelectOverlayPlot = useCallback(
		(plotId: string, plant: Plant) => {
			const ipcRenderer = (window as any).require?.("electron")?.ipcRenderer;
			if (!ipcRenderer) return;

			const nextSelection = overlayPlotId === plotId ? null : plotId;
			setOverlayPlotId(nextSelection);

			if (nextSelection) {
				ipcRenderer.send("show-plant-overlay");
				ipcRenderer.send("update-plant-overlay", {
					plantId: plant.id,
					plotId,
					plantType: plant.type,
					progress: plant.progress,
					plantedAt: plant.plantedAt,
					growthDuration: plant.growthDuration,
				});
			} else {
				ipcRenderer.send("close-plant-overlay");
			}
		},
		[overlayPlotId]
	);

	// Clear overlay selection if the plant is harvested
	useEffect(() => {
		if (!state || !overlayPlotId) {
			return;
		}
		const selectedPlot = state.plots.find((plot) => plot.id === overlayPlotId);
		if (selectedPlot && selectedPlot.plant) {
			return;
		}

		// Plant was harvested, close overlay
		const ipcRenderer = (window as any).require?.("electron")?.ipcRenderer;
		if (ipcRenderer) {
			ipcRenderer.send("close-plant-overlay");
		}
		setOverlayPlotId(null);
	}, [state, overlayPlotId]);

	// Update overlay with latest plant data
	useEffect(() => {
		if (!state || !overlayPlotId) return;

		const selectedPlot = state.plots.find((plot) => plot.id === overlayPlotId);
		if (!selectedPlot || !selectedPlot.plant) return;

		const ipcRenderer = (window as any).require?.("electron")?.ipcRenderer;
		if (!ipcRenderer) return;

		// Send updated plant data to overlay
		ipcRenderer.send("update-plant-overlay", {
			plantId: selectedPlot.plant.id,
			plotId: overlayPlotId,
			plantType: selectedPlot.plant.type,
			progress: selectedPlot.plant.progress,
			plantedAt: selectedPlot.plant.plantedAt,
			growthDuration: selectedPlot.plant.growthDuration,
		});
	}, [state, overlayPlotId]);

	// Listen to focus updates and adjust growth multiplier based on productivity score
	useEffect(() => {
		const ipcRenderer = (window as any).require?.("electron")?.ipcRenderer;
		if (!ipcRenderer) return;

		const handleFocusUpdate = (_event: any, data: any) => {
			if (data && typeof data.cumulative === "number") {
				// Convert cumulative score (0-1000) to growth multiplier (0.5x-3x)
				// Formula: multiplier = 0.5 + (score / 1000) * 2.5
				// 0 score = 0.5x, 200 score = 1.0x, 500 score = 1.75x, 1000 score = 3.0x
				const score = Math.max(0, Math.min(1000, data.cumulative)); // Clamp between 0-1000
				const newMultiplier = 0.5 + (score / 1000) * 2.5;

				// Only update if multiplier has changed significantly (avoid unnecessary updates)
				const currentMult = multiplier;
				if (Math.abs(newMultiplier - currentMult) > 0.01) {
					console.log(
						`[Garden] Updating growth multiplier: ${currentMult.toFixed(2)}x → ${newMultiplier.toFixed(
							2
						)}x (score: ${score.toFixed(1)})`
					);
					dispatch({ type: "setMultiplier", value: newMultiplier });
				}
			}
		};

		// Fetch initial focus score on mount
		ipcRenderer
			.invoke("get-focus-score")
			.then((focusScore: any) => {
				if (focusScore && typeof focusScore.cumulative === "number") {
					const score = Math.max(0, Math.min(1000, focusScore.cumulative));
					const initialMultiplier = 0.5 + (score / 1000) * 2.5;
					console.log(
						`[Garden] Setting initial growth multiplier: ${initialMultiplier.toFixed(
							2
						)}x (score: ${score.toFixed(1)})`
					);
					dispatch({ type: "setMultiplier", value: initialMultiplier });
				}
			})
			.catch((error: unknown) => {
				console.log("[Garden] Could not fetch initial focus score:", error);
			});

		ipcRenderer.on("focus-update", handleFocusUpdate);

		return () => {
			ipcRenderer.removeListener("focus-update", handleFocusUpdate);
		};
	}, [dispatch, multiplier]);

	// Now we can conditionally return
	if (!isReady || !state) {
		return (
			<main className="app app--loading">
				<div className="loading-card">
					<h1>Preparing Your Garden...</h1>
					<p>Loading soil, seeds, and sunshine.</p>
				</div>
			</main>
		);
	}

	return (
		<div className="app-shell">
			<header className="app__titlebar">
				<button className="app__titlebar-back" type="button" onClick={() => navigate("/")}>
					<span aria-hidden="true">←</span>
					<span className="app__titlebar-back-text">Dashboard</span>
				</button>
				<span className="app__titlebar-tagline">Grow Your Productivity Garden</span>
				<span className="app__titlebar-version">DH '2025</span>
			</header>

			{toast && (
				<div
					className={`app__toast ${toast.visible ? "app__toast--visible" : "app__toast--hiding"}`}
					role="button"
					aria-live="assertive"
					tabIndex={0}
					onClick={dismissToast}
					onKeyDown={(event) => {
						if (event.key === "Enter" || event.key === " ") {
							event.preventDefault();
							dismissToast();
						}
					}}
				>
					{toast.message}
				</div>
			)}

			<main className="app">
				<div className="app__body">
					<div className="app__main">
						<GardenGrid
							plots={state.plots}
							shakePlotId={shakePlotId ?? undefined}
							selectedOverlayPlotId={overlayPlotId ?? undefined}
							onSelectOverlayPlot={handleSelectOverlayPlot}
							onDropSeed={(plotId, seedType) => dispatch({ type: "plant", plotId, seedType })}
							onHarvest={(plotId) => dispatch({ type: "harvest", plotId })}
						/>
					</div>
				</div>
			</main>

			<InventoryToolbar
				state={state}
				seeds={seeds}
				multiplier={multiplier}
				isSeedShopOpen={isSeedShopOpen}
				onToggleSeedShop={() => setIsSeedShopOpen((prev) => !prev)}
			/>

			{isSeedShopOpen && (
				<div className="app-overlay" role="dialog" aria-modal="true">
					<div
						className="app-overlay__backdrop"
						onClick={() => setIsSeedShopOpen(false)}
						role="presentation"
						aria-hidden="true"
					/>
					<div className="app-overlay__panel">
						<SeedShop
							seeds={seeds}
							inventory={state.inventory}
							onBuySeed={(seedType) => dispatch({ type: "buySeed", seedType })}
							onClose={() => setIsSeedShopOpen(false)}
						/>
					</div>
				</div>
			)}
		</div>
	);
};

export default Garden;
