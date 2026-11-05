// Load environment variables
import dotenv from "dotenv";
dotenv.config();

import { app, BrowserWindow, ipcMain, screen } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FocusAI } from "./focus-ai";
import { FocusTracker } from "./focus-tracker";
import { databaseService } from "./services/database";

// Do NOT disable GPU on Windows; transparency and blur effects require hardware acceleration
// if (process.platform === "win32") {
// 	app.disableHardwareAcceleration();
// }

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
process.env.APP_ROOT = path.join(__dirname, "..");

export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;

class MainApp {
	mainWindow: BrowserWindow | null;
	debugWindow: BrowserWindow | null;
	overlayWindow: BrowserWindow | null;
	plantOverlayWindow: BrowserWindow | null;
	focusTracker: FocusTracker;
	focusAI: FocusAI;
	isDev: boolean;
	updateInterval: NodeJS.Timeout | null;
	sessionActive: boolean;
	sessionStartTime: number | null;
	overlayUpdateInterval: NodeJS.Timeout | null;
	scorePersistInterval: NodeJS.Timeout | null;
	lastPersistedScore: number;

	constructor() {
		this.mainWindow = null;
		this.debugWindow = null;
		this.overlayWindow = null;
		this.plantOverlayWindow = null;
		this.focusTracker = new FocusTracker();

		// Initialize FocusAI
		this.focusAI = new FocusAI();

		this.isDev = process.argv.includes("--dev");
		this.updateInterval = null;
		this.sessionActive = false;
		this.sessionStartTime = null;
		this.overlayUpdateInterval = null;
		this.scorePersistInterval = null;
		this.lastPersistedScore = 0;
	}

	createWindow() {
		console.log("Creating window...");

		this.mainWindow = new BrowserWindow({
			width: 1200,
			height: 800,
			minWidth: 1000,
			minHeight: 700,
			frame: true,
			titleBarStyle: "hiddenInset",
			autoHideMenuBar: true,
			backgroundColor: "#0f0f0f",
			show: false,
			webPreferences: {
				nodeIntegration: true,
				contextIsolation: false,
				preload: path.join(__dirname, "preload.mjs"),
			},
		});

		this.mainWindow.removeMenu();

		console.log("Loading main window...");

		if (VITE_DEV_SERVER_URL) {
			this.mainWindow.loadURL(VITE_DEV_SERVER_URL);
		} else {
			this.mainWindow.loadFile(path.join(RENDERER_DIST, "index.html"));
		}

		// Show window when ready
		this.mainWindow.once("ready-to-show", () => {
			this.mainWindow?.show();
		});

		if (this.isDev) {
			this.mainWindow.webContents.openDevTools();
		}

		console.log("Window created successfully");
	}

	createOverlayWindow() {
		console.log("🪟 createOverlayWindow called");
		if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
			console.log("⚠️ Overlay window already exists, returning");
			return;
		}

		const { width, height } = screen.getPrimaryDisplay().workAreaSize;
		console.log("📏 Screen dimensions:", { width, height });
		const overlayWidth = 380;
		const overlayHeight = 160;
		const x = Math.round((width - overlayWidth) / 2);
		const y = 20;
		console.log("📍 Overlay position:", { x, y, overlayWidth, overlayHeight });

		// Platform-specific overlay configuration
		const isMac = process.platform === "darwin";
		const isWindows = process.platform === "win32";

		const overlayConfig: Electron.BrowserWindowConstructorOptions = {
			width: overlayWidth,
			height: overlayHeight,
			minWidth: 300,
			minHeight: 120,
			maxWidth: 600,
			maxHeight: 400,
			x,
			y,
			frame: false,
			transparent: true,
			resizable: !isWindows,
			movable: true,
			alwaysOnTop: true,
			skipTaskbar: false,
			focusable: true,
			backgroundColor: "#1a1a1a",
			show: true,
			fullscreenable: false,
			maximizable: false,
			minimizable: false,
			closable: true,
    webPreferences: {
				nodeIntegration: true,
				contextIsolation: false,
				preload: path.join(__dirname, "preload.mjs"),
			},
		};

		// macOS-specific settings
		if (isMac) {
			overlayConfig.titleBarStyle = "hidden";
			// Use a supported vibrancy type
			overlayConfig.vibrancy = "under-window";
			overlayConfig.visualEffectState = "active";
		}

		// Windows-specific settings
		if (isWindows) {
			overlayConfig.autoHideMenuBar = true;
			overlayConfig.thickFrame = false;
			overlayConfig.hasShadow = false;
			// IMPORTANT: Do NOT set backgroundMaterial (like 'acrylic') when using transparent windows
			// as it will break true transparency on Windows.
		}

		const baseOverlaySize = { width: overlayWidth, height: overlayHeight };

		const overlayWindow = new BrowserWindow({
			...overlayConfig,
			// Ensure client area sizing is consistent and not impacted by frame metrics
			useContentSize: true,
		});

		this.overlayWindow = overlayWindow;

		if (!overlayWindow.isDestroyed()) {
			const [createdWidth, createdHeight] = overlayWindow.getSize();
			baseOverlaySize.width = createdWidth;
			baseOverlaySize.height = createdHeight;
		}

		const enforceOverlaySize = () => {
			if (!this.overlayWindow || this.overlayWindow.isDestroyed()) return;
			const [currentWidth, currentHeight] = this.overlayWindow.getSize();
			if (currentWidth !== baseOverlaySize.width || currentHeight !== baseOverlaySize.height) {
				this.overlayWindow.setSize(baseOverlaySize.width, baseOverlaySize.height, false);
			}
		};

		// Platform-specific window behavior
		if (isMac) {
			overlayWindow.setAlwaysOnTop(true, "screen-saver");
			overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
			// Enable click-through for macOS
			overlayWindow.setIgnoreMouseEvents(false);
			// macOS: Make overlay visible across all spaces and full-screen apps
			overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
		} else if (isWindows) {
			overlayWindow.setAlwaysOnTop(true, "screen-saver");
			// Windows-specific transparency handling
			overlayWindow.setIgnoreMouseEvents(false);
			// Windows: Set window level to stay above all windows
			try {
				// Use Windows-specific API if available
				overlayWindow.setAlwaysOnTop(true, "floating");
			} catch (_err) {
				// Fallback to screen-saver level when floating not available
				overlayWindow.setAlwaysOnTop(true, "screen-saver");
			}
			overlayWindow.setHasShadow(false);
			overlayWindow.setBackgroundColor("#00000000");
			overlayWindow.setResizable(false);
			overlayWindow.on("will-resize", (event) => {
				event.preventDefault();
				enforceOverlaySize();
			});
			overlayWindow.on("resize", enforceOverlaySize);
		}

  if (VITE_DEV_SERVER_URL) {
			this.overlayWindow.loadURL(VITE_DEV_SERVER_URL + "#/overlay");
		} else {
			this.overlayWindow.loadFile(path.join(RENDERER_DIST, "index.html"), {
				hash: "/overlay",
			});
		}

		this.overlayWindow.once("ready-to-show", () => {
			console.log("✅ Overlay window ready to show");
			if (isWindows) {
				console.log("🪟 Setting Windows-specific overlay properties...");
				overlayWindow.setBackgroundColor("#00000000");
				enforceOverlaySize();
			}
			console.log("📏 Overlay window bounds:", this.overlayWindow?.getBounds());
			console.log("👁️ Showing overlay window (ready-to-show)...");
			this.overlayWindow?.showInactive();
			console.log("✅ Overlay window shown from ready-to-show event");
		});

		// After content loads, force HTML/BODY to be transparent to honor window transparency
		this.overlayWindow.webContents.on("did-finish-load", () => {
			try {
				this.overlayWindow?.webContents.insertCSS(
					"html, body { background: transparent !important; background-color: transparent !important; }"
				);
				// Double-ensure background color at the window level remains transparent
				this.overlayWindow?.setBackgroundColor("#00000000");
			} catch (_err) {
				// no-op: transparency CSS injection is best-effort
			}
		});

		this.overlayWindow.on("closed", () => {
			console.log("Overlay window closed");
			this.overlayWindow = null;
		});

		// Add drag functionality
		this.overlayWindow.webContents.on("before-input-event", (_event, input) => {
			if (input.type === "mouseDown") {
				this.overlayWindow?.setIgnoreMouseEvents(false);
			}
		});
	}

	showOverlay(sessionStart: number) {
		console.log("🪟 Creating overlay window...");
		this.createOverlayWindow();
		if (!this.overlayWindow) {
			console.log("❌ ERROR: Overlay window was not created");
			return;
		}
		console.log("✅ Overlay window created successfully");
		console.log("📏 Overlay window bounds:", this.overlayWindow.getBounds());
		console.log("👁️ Overlay window visible:", this.overlayWindow.isVisible());
		console.log("🔍 Overlay window minimized:", this.overlayWindow.isMinimized());

		if (this.overlayWindow.isMinimized()) {
			console.log("🔄 Restoring minimized overlay window...");
			this.overlayWindow.restore();
		}

		console.log("👁️ Showing overlay window...");
		this.overlayWindow.showInactive();
		console.log("✅ Overlay window shown");
		console.log("📏 Final overlay window bounds:", this.overlayWindow.getBounds());
		console.log("👁️ Final overlay window visible:", this.overlayWindow.isVisible());

		// Send start event with timestamp after load
		const sendStart = () => {
			try {
				this.overlayWindow?.webContents.send("session-started", { startTime: sessionStart });
				console.log("Session start event sent to overlay");
			} catch (error: unknown) {
				console.error("Error sending session start event:", error);
			}
		};

		// Send an immediate overlay update with the current restored cumulative score
		const sendInitialOverlayUpdate = () => {
			try {
				this.overlayWindow?.webContents.send("focus-update", {
					windowTitle: null,
					url: null,
					instantaneous: 0,
					cumulative: this.focusAI.cumulativeScore,
					aiInsight: "Restored score from database",
					context: "Restored",
					timestamp: Date.now(),
				});
				console.log(
					"Initial overlay focus-update sent with restored cumulative score:",
					this.focusAI.cumulativeScore
				);
			} catch (error: unknown) {
				console.error("Error sending initial overlay update:", error);
			}
		};

		if (this.overlayWindow.webContents.isLoading()) {
			this.overlayWindow.webContents.once("did-finish-load", () => {
				sendStart();
				sendInitialOverlayUpdate();
			});
  } else {
			sendStart();
			sendInitialOverlayUpdate();
		}

		// Start frequent overlay updates (every 2s) to reflect window/title/URL changes
		this.startOverlayUpdates();
		console.log("Overlay updates started");
	}

	hideOverlay() {
		if (!this.overlayWindow || this.overlayWindow.isDestroyed()) return;
		try {
			this.overlayWindow.webContents.send("session-stopped");
		} catch (_err) {
			// no-op: overlay stop is best-effort
		}
		this.overlayWindow.hide();
		this.stopOverlayUpdates();
	}

	createPlantOverlayWindow() {
		console.log("createPlantOverlayWindow called");
		if (this.plantOverlayWindow && !this.plantOverlayWindow.isDestroyed()) {
			console.log("Plant overlay window already exists, returning");
			return;
		}

		const { width } = screen.getPrimaryDisplay().workAreaSize;
		const overlayWidth = 250;
		const overlayHeight = 320;
		const x = Math.round(width - overlayWidth - 40); // Position on right side
		const y = 80;

		// Platform-specific overlay configuration
		const isMac = process.platform === "darwin";
		const isWindows = process.platform === "win32";

		const overlayConfig: Electron.BrowserWindowConstructorOptions = {
			width: overlayWidth,
			height: overlayHeight,
			minWidth: 200,
			minHeight: 250,
			maxWidth: 500,
			maxHeight: 600,
			x,
			y,
			frame: false,
			transparent: true,
			resizable: true,
			movable: true,
			alwaysOnTop: true,
			skipTaskbar: true,
			focusable: false,
			backgroundColor: "#00000000",
			show: false,
			fullscreenable: false,
			maximizable: false,
			minimizable: false,
			closable: true,
			webPreferences: {
				nodeIntegration: true,
				contextIsolation: false,
				preload: path.join(__dirname, "preload.mjs"),
			},
		};

		// macOS-specific settings
		if (isMac) {
			overlayConfig.titleBarStyle = "hidden";
			// Avoid unsupported vibrancy string literals; leave default vibrancy for compatibility
			// overlayConfig.vibrancy = "under-window";
			overlayConfig.visualEffectState = "active";
		}

		// Windows-specific settings
		if (isWindows) {
			overlayConfig.autoHideMenuBar = true;
			overlayConfig.thickFrame = false;
			overlayConfig.resizable = false;
		}

		this.plantOverlayWindow = new BrowserWindow(overlayConfig);

		// Platform-specific window behavior
		if (isMac) {
			this.plantOverlayWindow.setAlwaysOnTop(true, "screen-saver");
			this.plantOverlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
			this.plantOverlayWindow.setIgnoreMouseEvents(false);
		} else if (isWindows) {
			this.plantOverlayWindow.setAlwaysOnTop(true, "screen-saver");
			this.plantOverlayWindow.setIgnoreMouseEvents(false);
			try {
				this.plantOverlayWindow.setAlwaysOnTop(true, "floating");
			} catch (err) {
				this.plantOverlayWindow.setAlwaysOnTop(true, "screen-saver");
			}
		}

		if (VITE_DEV_SERVER_URL) {
			this.plantOverlayWindow.loadURL(VITE_DEV_SERVER_URL + "#/plant-overlay");
		} else {
			this.plantOverlayWindow.loadFile(path.join(RENDERER_DIST, "index.html"), {
				hash: "/plant-overlay",
			});
		}

		// Ensure the plant overlay honors transparent window background
		this.plantOverlayWindow.webContents.on("did-finish-load", () => {
			try {
				this.plantOverlayWindow?.webContents.insertCSS(
					"html, body { background: transparent !important; background-color: transparent !important; }"
				);
				this.plantOverlayWindow?.setBackgroundColor("#00000000");
			} catch (_err) {
				// no-op: transparency CSS injection is best-effort
			}
		});

		this.plantOverlayWindow.once("ready-to-show", () => {
			console.log("Plant overlay window ready to show");
			this.plantOverlayWindow?.setBackgroundColor("#00000000");
			this.plantOverlayWindow?.showInactive();
		});

		this.plantOverlayWindow.on("closed", () => {
			console.log("Plant overlay window closed");
			this.plantOverlayWindow = null;
		});
	}

	showPlantOverlay() {
		console.log("Showing plant overlay window...");
		this.createPlantOverlayWindow();
	}

	hidePlantOverlay() {
		if (!this.plantOverlayWindow || this.plantOverlayWindow.isDestroyed()) return;
		this.plantOverlayWindow.hide();
	}

	closePlantOverlay() {
		if (!this.plantOverlayWindow || this.plantOverlayWindow.isDestroyed()) return;
		this.plantOverlayWindow.close();
		this.plantOverlayWindow = null;
	}

	startOverlayUpdates() {
		this.stopOverlayUpdates();
		this.overlayUpdateInterval = setInterval(async () => {
			try {
				if (!this.overlayWindow || this.overlayWindow.isDestroyed()) return;
				const currentWindow = this.focusTracker.currentWindow;
				if (currentWindow && !currentWindow.isComplete) {
					const summary = currentWindow.getSummary();
					// Get current focus score for overlay
					const focusData = await this.focusAI.calculateHybridScore(summary);
					this.overlayWindow.webContents.send("focus-update", {
						windowTitle: summary.windowTitle,
						url: summary.url,
						instantaneous: focusData.instantaneous,
						cumulative: focusData.cumulative,
						aiInsight: focusData.aiInsight,
						context: focusData.context,
						timestamp: Date.now(),
					});
				}
			} catch (_err) {
				// no-op: overlay move is best-effort
			}
		}, 5000); // Every 5 seconds for overlay updates
	}

	stopOverlayUpdates() {
		if (this.overlayUpdateInterval) {
			clearInterval(this.overlayUpdateInterval);
			this.overlayUpdateInterval = null;
		}
	}

	startTracking() {
		this.focusTracker.start();

		// Clear any existing update interval
		if (this.updateInterval) {
			clearInterval(this.updateInterval);
			this.updateInterval = null;
		}

		console.log("FocusAI starting focus tracking...");

		// Start sending focus updates immediately (don't wait for window load)
			this.updateInterval = setInterval(async () => {
				try {
					const currentWindow = this.focusTracker.currentWindow;
					if (currentWindow && !currentWindow.isComplete) {
						// Get the current window summary for scoring
						const windowSummary = currentWindow.getSummary();

						const focusData = await this.focusAI.calculateHybridScore(windowSummary);

						// Transform data for dashboard
						const dashboardData = {
							instantaneous: focusData.instantaneous,
							cumulative: focusData.cumulative,
							aiInsight: focusData.aiInsight,
							context: focusData.context,
							activeApp: windowSummary.activeApp,
							windowTitle: windowSummary.windowTitle,
							url: windowSummary.url,
							switchRate: windowSummary.switchRate,
							timestamp: Date.now(),
						};

					// Send to main dashboard window
						if (this.mainWindow && !this.mainWindow.isDestroyed()) {
							this.mainWindow.webContents.send("focus-update", dashboardData);
						console.log("📊 Sent focus update to dashboard:", {
							instantaneous: focusData.instantaneous,
							cumulative: focusData.cumulative,
							context: focusData.context,
						});
						}

					// Mirror to overlay with productivity scores
						if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
							this.overlayWindow.webContents.send("focus-update", {
								windowTitle: windowSummary.windowTitle,
								url: windowSummary.url,
							instantaneous: focusData.instantaneous,
							cumulative: focusData.cumulative,
							aiInsight: focusData.aiInsight,
							context: focusData.context,
								timestamp: Date.now(),
							});
						}

						// Also send to debug console if it exists
						if (this.debugWindow && !this.debugWindow.isDestroyed()) {
							this.debugWindow.webContents.send("focus-update", dashboardData);
						}
					}
				} catch (error) {
					console.error("Error sending focus update:", error);
				}
		}, 30000); // Every 30 seconds (reduced frequency for event-driven system)
	}

	stopTracking() {
		if (this.updateInterval) {
			clearInterval(this.updateInterval);
			this.updateInterval = null;
			console.log("FocusAI tracking stopped");
		}
	}

	async sendImmediateFocusUpdate() {
		try {
			const currentWindow = this.focusTracker.currentWindow;
			if (currentWindow) {
				const windowSummary = currentWindow.getSummary();
				const focusData = await this.focusAI.calculateHybridScore(windowSummary);

				const dashboardData = {
					instantaneous: focusData.instantaneous,
					cumulative: focusData.cumulative,
					aiInsight: focusData.aiInsight,
					context: focusData.context,
					activeApp: windowSummary.activeApp,
					windowTitle: windowSummary.windowTitle,
					url: windowSummary.url,
					switchRate: windowSummary.switchRate,
					timestamp: Date.now(),
				};

				// Send to main dashboard window
				if (this.mainWindow && !this.mainWindow.isDestroyed()) {
					this.mainWindow.webContents.send("focus-update", dashboardData);
					console.log("📊 Sent immediate focus update to dashboard:", {
						instantaneous: focusData.instantaneous,
						cumulative: focusData.cumulative,
						context: focusData.context,
					});
				}
			}
		} catch (error) {
			console.error("Error sending immediate focus update:", error);
		}
	}

	private startScorePersistence() {
		this.stopScorePersistence();
		// Persist every 30 seconds if score changed by at least 1 point
		this.scorePersistInterval = setInterval(async () => {
			try {
				const current = Math.floor(this.focusAI.cumulativeScore);
				if (current !== this.lastPersistedScore) {
					await databaseService.setScore(current);
					this.lastPersistedScore = current;
					console.log(`💾 Persisted cumulative score to DB: ${current}`);
				}
			} catch (error: unknown) {
				// Non-fatal; keep app running even if DB write fails
				console.warn("⚠️ Failed to persist score:", (error as Error)?.message || error);
			}
		}, 30000);
	}

	private stopScorePersistence() {
		if (this.scorePersistInterval) {
			clearInterval(this.scorePersistInterval);
			this.scorePersistInterval = null;
		}
	}

	setupIPC() {
		ipcMain.handle("get-current-metrics", () => {
			return this.focusTracker.getCurrentMetrics();
		});

		ipcMain.handle("get-focus-score", async () => {
			const currentWindow = this.focusTracker.currentWindow;
			if (currentWindow) {
				return await this.focusAI.calculateHybridScore(currentWindow.getSummary());
			}
			return null;
		});

		ipcMain.handle("get-garden-level", () => {
			return this.focusAI.getGardenGrowthLevel();
		});

		// Handle overlay window movement
		ipcMain.on("overlay-move", (_e, { x, y }) => {
			if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
				try {
					this.overlayWindow.setPosition(Math.round(x), Math.round(y));
				} catch (_err) {
					// no-op: plant overlay move is best-effort
				}
			}
		});

		// Handle opening debug page (now handled by navigation)
		// ipcMain.on("open-debug-page", () => {
		// 	this.openDebugPage();
		// });

		// Handle session control
		ipcMain.on("start-session", async () => {
			console.log("🎯 Starting focus session...");
			console.log("📊 Session active:", this.sessionActive);
			console.log("🪟 Main window exists:", !!this.mainWindow);
			console.log("🪟 Overlay window exists:", !!this.overlayWindow);

				this.sessionActive = true;
				this.sessionStartTime = Date.now();

			console.log("🚀 Starting focus tracker...");
				this.focusTracker.start();

			console.log("📡 Starting tracking updates...");
				this.startTracking();

			// Send initial focus update immediately
			this.sendImmediateFocusUpdate();

			console.log("🪟 Creating and showing overlay...");
				this.showOverlay(this.sessionStartTime);
			console.log("✅ Overlay creation completed");

			// Begin periodic DB persistence
			this.lastPersistedScore = Math.floor(this.focusAI.cumulativeScore);
			this.startScorePersistence();
		});

		ipcMain.on("stop-session", async () => {
			console.log("Stopping focus session...");
			if (this.sessionActive) {
				// Persist final cumulative score immediately so DB reflects total
				try {
					const finalScore = Math.floor(this.focusAI.cumulativeScore);
					if (typeof finalScore === "number" && !Number.isNaN(finalScore)) {
						await databaseService.setScore(finalScore);
						this.lastPersistedScore = finalScore;
						console.log(`💾 Final cumulative score persisted to DB: ${finalScore}`);
					}
				} catch (error: unknown) {
					console.warn("⚠️ Failed to persist final score on stop:", (error as Error)?.message || error);
				}

				this.sessionActive = false;
				this.sessionStartTime = null;
				this.focusTracker.stop();
				this.stopTracking();
				this.hideOverlay();
				this.stopScorePersistence();
			}
		});

		// Permission checks removed - no longer needed without keystroke tracking

		// Handle immediate metadata extraction requests
		ipcMain.on("extract-metadata", async () => {
			console.log("Immediate metadata extraction requested");
			if (this.focusTracker && !this.focusTracker.demoMode) {
				await this.focusTracker.detectContextChanges();
			}
		});

		// Plant overlay IPC handlers
		ipcMain.on("show-plant-overlay", () => {
			console.log("Show plant overlay requested");
			this.showPlantOverlay();
		});

		ipcMain.on("hide-plant-overlay", () => {
			console.log("Hide plant overlay requested");
			this.hidePlantOverlay();
		});

		ipcMain.on("close-plant-overlay", () => {
			console.log("Close plant overlay requested");
			this.closePlantOverlay();
		});

		ipcMain.on("update-plant-overlay", (_e, data) => {
			if (this.plantOverlayWindow && !this.plantOverlayWindow.isDestroyed()) {
				this.plantOverlayWindow.webContents.send("plant-data-update", data);
			}
		});

		ipcMain.on("plant-overlay-move", (_e, { x, y }) => {
			if (this.plantOverlayWindow && !this.plantOverlayWindow.isDestroyed()) {
				try {
					this.plantOverlayWindow.setPosition(Math.round(x), Math.round(y));
				} catch (_err) {
					// no-op: plant overlay move is best-effort
				}
			}
		});

		// Handle auth token updates
		ipcMain.on("set-auth-token", async (_e, token: string) => {
			console.log("🔑 Main process: Auth token received from renderer");
			console.log("🔑 Main process: Token length:", token?.length || 0);
			databaseService.setAuthToken(token);
			console.log("✅ Main process: Token stored in database service");

			// Restore FocusAI cumulative score from database
			try {
				console.log("🔄 Attempting to restore FocusAI score from database...");
				const score = await databaseService.fetchScore();
				this.focusAI.restoreCumulativeScore(score);
				console.log(`✅ FocusAI score restored: ${score}`);

				// If overlay is already open, push an immediate update so UI reflects DB value
				if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
					this.overlayWindow.webContents.send("focus-update", {
						windowTitle: null,
						url: null,
						instantaneous: 0,
						cumulative: this.focusAI.cumulativeScore,
						aiInsight: "Restored score from database",
						context: "Restored",
						timestamp: Date.now(),
					});
					console.log("Overlay updated immediately after score restore");
				}
			} catch (error: unknown) {
				console.error("❌ Failed to restore FocusAI score:", (error as Error).message ?? error);
				console.warn("⚠️ Database unavailable. FocusAI will start with default score of 0");
				console.warn(
					"⚠️ To enable database sync, set up MongoDB credentials in .env file (see MONGODB_SETUP.md)"
				);
			}
		});

		// Handle fetching score from database
		ipcMain.handle("fetch-score", async () => {
			try {
				const score = await databaseService.fetchScore();
				return { success: true, score };
			} catch (error: unknown) {
				console.error("Error fetching score:", (error as Error).message ?? error);
				return { success: false, error: (error as Error).message };
			}
		});

		// Handle updating score in database
		ipcMain.handle("update-score", async (_e, score: number) => {
			try {
				await databaseService.updateScore(score);
				return { success: true };
			} catch (error: unknown) {
				console.error("Error updating score:", (error as Error).message ?? error);
				return { success: false, error: (error as Error).message };
			}
		});

		// Handle setting score in database (overwrite)
		ipcMain.handle("set-score", async (_e, score: number) => {
			console.log(`📨 Main process received set-score IPC with score: ${score}`);
			try {
				await databaseService.setScore(score);
				console.log(`✅ Main process: setScore completed successfully`);
				return { success: true };
			} catch (error: unknown) {
				console.error("❌ Main process error setting score:", (error as Error).message ?? error);
				return { success: false, error: (error as Error).message };
			}
		});

		// Handle fetching all users' scores (leaderboard)
		ipcMain.handle("fetch-all-scores", async () => {
			try {
				const scores = await databaseService.getAllScores();
				return { success: true, scores };
			} catch (error: any) {
				console.error("Error fetching all scores:", error.message);
				return { success: false, error: error.message };
			}
		});

		// Handle saving basic user profile details
		ipcMain.handle(
			"save-user-profile",
			async (_e, { userId, username, email }: { userId: string; username: string; email: string }) => {
				try {
					await databaseService.saveUserProfile(userId, username, email);
					return { success: true };
				} catch (error: any) {
					console.error("Error saving user profile:", error.message);
					return { success: false, error: error.message };
				}
			}
		);

		// Handle debug data requests
		ipcMain.on("request-debug-data", () => {
				const currentWindow = this.focusTracker.currentWindow;
				if (currentWindow && !currentWindow.isComplete) {
					const windowSummary = currentWindow.getSummary();
					this.focusAI
						.calculateHybridScore(windowSummary)
						.then((focusData) => {
							const debugData = {
								instantaneous: focusData.instantaneous,
								cumulative: focusData.cumulative,
								aiInsight: focusData.aiInsight,
								context: focusData.context,
								activeApp: windowSummary.activeApp,
								windowTitle: windowSummary.windowTitle,
								url: windowSummary.url,
								switchRate: windowSummary.switchRate,
								baseScore: focusData.baseScore,
								aiMultiplier: focusData.aiMultiplier,
								focusRatio: windowSummary.focusRatio,
								timestamp: Date.now(),
							};

						// Send to both debug window (if exists) and main window
						if (this.debugWindow && !this.debugWindow.isDestroyed()) {
							this.debugWindow.webContents.send("focus-update", debugData);
						}

						// Send to main window for debug console
						if (this.mainWindow && !this.mainWindow.isDestroyed()) {
							this.mainWindow.webContents.send("focus-update", debugData);
						}
						})
						.catch((error) => {
							console.error("Error calculating debug data:", error);
						});
			}
		});
	}

	openDebugPage() {
		this.debugWindow = new BrowserWindow({
			width: 1400,
			height: 900,
			minWidth: 1200,
			minHeight: 800,
			frame: true,
			titleBarStyle: "hiddenInset",
			autoHideMenuBar: true,
			backgroundColor: "#0a0a0a",
			show: false,
			parent: this.mainWindow || undefined,
			webPreferences: {
				nodeIntegration: true,
				contextIsolation: false,
				preload: path.join(__dirname, "preload.mjs"),
			},
		});

		this.debugWindow.removeMenu();

		if (VITE_DEV_SERVER_URL) {
			this.debugWindow.loadURL(VITE_DEV_SERVER_URL + "#/debug");
		} else {
			this.debugWindow.loadFile(path.join(RENDERER_DIST, "index.html"), {
				hash: "/debug",
			});
		}

		this.debugWindow.once("ready-to-show", () => {
			this.debugWindow?.show();
		});

		// Clean up reference when debug window is closed
		this.debugWindow.on("closed", () => {
			this.debugWindow = null;
		});

		if (this.isDev) {
			this.debugWindow.webContents.openDevTools();
		}

		// Start sending debug data
		this.debugWindow.webContents.once("did-finish-load", () => {
			console.log("Debug console loaded");

			// Send initial data
			const currentWindow = this.focusTracker.currentWindow;
			if (currentWindow) {
				const windowSummary = currentWindow.getSummary();
				this.focusAI.calculateHybridScore(windowSummary).then((focusData) => {
					const debugData = {
						instantaneous: focusData.instantaneous,
						cumulative: focusData.cumulative,
						aiInsight: focusData.aiInsight,
						context: focusData.context,
						activeApp: windowSummary.activeApp,
						windowTitle: windowSummary.windowTitle,
						url: windowSummary.url,
						switchRate: windowSummary.switchRate,
						baseScore: focusData.baseScore,
						aiMultiplier: focusData.aiMultiplier,
						timestamp: Date.now(),
					};

					this.debugWindow?.webContents.send("focus-update", debugData);
				});
			}
		});
	}
}

const mainApp = new MainApp();

app.whenReady().then(() => {
	mainApp.createWindow();
	mainApp.setupIPC();

	app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
			mainApp.createWindow();
		}
	});
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});

app.on("before-quit", () => {
	mainApp.focusTracker.stop();
	if (mainApp.updateInterval) {
		clearInterval(mainApp.updateInterval);
	}
});
