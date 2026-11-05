import { fetchScore, setScore } from "../utils/database";
import { createInitialGardenState, GardenState, Plant, PlantType } from "./index";

export interface GardenStorage {
	load(): Promise<GardenState>;
	save(state: GardenState): Promise<void>;
}

export interface SeedDefinition {
	type: PlantType;
	displayName: string;
	description: string;
	growthDuration: number; // seconds
	harvestReward: number;
	seedCost: number;
	icon: string;
}

type LibraryPlantType = PlantType;

// Default growth durations (in seconds) - can be overridden
export interface GrowthConfig {
	durations: Record<PlantType, number>;
}

// Default configuration
const DEFAULT_GROWTH_CONFIG: GrowthConfig = {
	durations: {
		seedling: 60, // 1 minute
		blossom: 300, // 5 minutes
		evergreen: 600, // 10 minutes
		rose: 1200, // 20 minutes
		lavender: 1800, // 30 minutes
		beanstalk: 3600, // 1 hour
		sixtyseven: 420, // 7 minutes
	},
};

// Allow external configuration
let currentGrowthConfig: GrowthConfig = { ...DEFAULT_GROWTH_CONFIG };

export function setGrowthConfig(config: Partial<GrowthConfig>): void {
	currentGrowthConfig = {
		durations: {
			...currentGrowthConfig.durations,
			...(config.durations || {}),
		},
	};
}

export function getGrowthConfig(): GrowthConfig {
	return { ...currentGrowthConfig };
}

export function resetGrowthConfig(): void {
	currentGrowthConfig = { ...DEFAULT_GROWTH_CONFIG };
}

// Build SEED_LIBRARY dynamically based on current config
export function getSeedLibrary(): Record<LibraryPlantType, SeedDefinition> {
	const config = getGrowthConfig();
	return {
		seedling: {
			type: "seedling",
			displayName: "Morning Sprout",
			description: "Quick-growing beginner plant.",
			growthDuration: config.durations.seedling,
			harvestReward: 5,
			seedCost: 2,
			icon: "seedling.svg",
		},
		blossom: {
			type: "blossom",
			displayName: "Blooming Lilac",
			description: "Balanced growth and reward.",
			growthDuration: config.durations.blossom,
			harvestReward: 20,
			seedCost: 5,
			icon: "blossom.svg",
		},
		evergreen: {
			type: "evergreen",
			displayName: "Evergreen Sapling",
			description: "Slow grower with generous harvest.",
			growthDuration: config.durations.evergreen,
			harvestReward: 50,
			seedCost: 10,
			icon: "evergreen.svg",
		},
		rose: {
			type: "rose",
			displayName: "Crimson Rose",
			description: "Short bloom with a bold harvest bonus.",
			growthDuration: config.durations.rose,
			harvestReward: 70,
			seedCost: 30,
			icon: "rose.svg",
		},
		lavender: {
			type: "lavender",
			displayName: "Moonlit Lavender",
			description: "A calming mid-length grower with steady returns.",
			growthDuration: config.durations.lavender,
			harvestReward: 150,
			seedCost: 90,
			icon: "lavender.svg",
		},
		beanstalk: {
			type: "beanstalk",
			displayName: "Skyward Beanstalk",
			description: "Tall climber with a hearty harvest for patient gardeners.",
			growthDuration: config.durations.beanstalk,
			harvestReward: 300,
			seedCost: 150,
			icon: "beanstalk.svg",
		},
		sixtyseven: {
			type: "sixtyseven",
			displayName: "Six Sevenium",
			description: "A curious numerical bloom that adds quirky prosperity.",
			growthDuration: config.durations.sixtyseven,
			harvestReward: 67,
			seedCost: 42,
			icon: "sixtyseven.svg",
		},
	};
}

// Legacy export - use getSeedLibrary() for dynamic access
export const SEED_LIBRARY = getSeedLibrary();

type Listener = (state: GardenState) => void;

interface TickOptions {
	skipPersistence?: boolean;
}

const DEFAULT_UNLOCK_COST = 50;

const createId = () => `plant-${Math.random().toString(36).slice(2, 10)}`;

export class GardenGame {
	private state: GardenState;
	private listeners: Set<Listener> = new Set();
	private growthMultiplier = 1;
	private lock = Promise.resolve();

	private constructor(private readonly storage: GardenStorage, initialState: GardenState) {
		this.state = initialState;
	}

	static async create(storage: GardenStorage): Promise<GardenGame> {
		const stored = await storage.load().catch(() => createInitialGardenState());

		const initial = stored ?? createInitialGardenState();

		// Fetch score from database and restore if higher than local storage
		try {
			console.log("🔄 Fetching score from database...");
			const dbScore = await fetchScore();

			if (dbScore !== null && dbScore > initial.inventory.currency) {
				console.log(
					`📊 Database score (${dbScore}) is higher than local storage (${initial.inventory.currency})`
				);
				console.log(`🔄 Restoring score from database: ${dbScore}`);
				initial.inventory.currency = dbScore;
			} else if (dbScore !== null) {
				console.log(`📊 Local storage score (${initial.inventory.currency}) is current (database: ${dbScore})`);
			} else {
				console.log("ℹ️ No score found in database, using local storage");
			}
		} catch (error) {
			console.error("❌ Failed to fetch score from database:", error);
			console.log("ℹ️ Using local storage score:", initial.inventory.currency);
		}

		const game = new GardenGame(storage, initial);
		game.applyOfflineGrowth();
		await game.persistState();

		// Sync initial score to database
		game.syncScoreToDatabase();

		return game;
	}

	subscribe(listener: Listener) {
		this.listeners.add(listener);
		listener(this.cloneState());
		return () => {
			this.listeners.delete(listener);
		};
	}

	getGardenState(): GardenState {
		return this.cloneState();
	}

	getMultiplier() {
		return this.growthMultiplier;
	}

	async plantSeed(plotId: string, seedType: PlantType) {
		const seedLibrary = getSeedLibrary();
		const definition = seedLibrary[seedType];
		if (!definition) {
			throw new Error(`Unknown seed type: ${seedType}`);
		}

		const plot = this.state.plots.find((item) => item.id === plotId);
		if (!plot) {
			throw new Error(`Plot not found: ${plotId}`);
		}

		if (plot.plant) {
			throw new Error("Plot already occupied");
		}

		const availableSeeds = this.state.inventory.seeds[seedType] ?? 0;
		if (availableSeeds <= 0) {
			throw new Error("No seeds available");
		}

		const newPlant: Plant = {
			id: createId(),
			type: seedType,
			plantedAt: Date.now(),
			growthDuration: definition.growthDuration,
			progress: 0,
		};

		plot.plant = newPlant;
		this.state.inventory.seeds[seedType] = availableSeeds - 1;

		await this.persistAndNotify();
	}

	async harvestCrop(plotId: string) {
		const plot = this.state.plots.find((item) => item.id === plotId);
		if (!plot || !plot.plant) {
			throw new Error("No plant to harvest");
		}

		if (plot.plant.progress < 1) {
			throw new Error("Plant is not ready to harvest");
		}

		const seedLibrary = getSeedLibrary();
		const definition = seedLibrary[plot.plant.type];
		plot.plant = null;
		this.addCurrency(definition.harvestReward);

		await this.persistAndNotify();
	}

	addCurrency(amount: number) {
		this.state.inventory.currency = Math.max(0, this.state.inventory.currency + amount);
		// Sync score to database
		this.syncScoreToDatabase();
	}

	/**
	 * Sync current currency (score) to database
	 */
	private syncScoreToDatabase() {
		const currentScore = this.state.inventory.currency;
		console.log(`🔄 Attempting to sync score to database: ${currentScore}`);
		// Use Promise to avoid blocking, but don't await to keep it non-blocking
		setScore(currentScore)
			.then((success) => {
				if (success) {
					console.log(`✅ Score synced successfully: ${currentScore}`);
				} else {
					console.warn(`⚠️ Score sync returned false for: ${currentScore}`);
				}
			})
			.catch((error) => {
				console.error("❌ Failed to sync score to database:", error);
			});
	}

	async unlockPlot(cost = DEFAULT_UNLOCK_COST) {
		if (this.state.inventory.currency < cost) {
			throw new Error("Not enough currency to unlock plot");
		}

		const nextIndex = this.state.plots.length + 1;
		this.state.inventory.currency -= cost;
		this.state.plots.push({
			id: `plot-${nextIndex}`,
			plant: null,
		});

		// Sync score to database
		this.syncScoreToDatabase();

		await this.persistAndNotify();
	}

	async buySeed(seedType: PlantType) {
		const seedLibrary = getSeedLibrary();
		const definition = seedLibrary[seedType];
		if (this.state.inventory.currency < definition.seedCost) {
			throw new Error("Not enough currency for this seed");
		}

		this.state.inventory.currency -= definition.seedCost;
		this.state.inventory.seeds[seedType] = (this.state.inventory.seeds[seedType] ?? 0) + 1;

		// Sync score to database
		this.syncScoreToDatabase();

		await this.persistAndNotify();
	}

	setGrowthMultiplier(multiplier: number) {
		this.growthMultiplier = Math.max(0, multiplier);
	}

	async tick(deltaTimeSeconds: number, options: TickOptions = {}) {
		const delta = Math.max(0, deltaTimeSeconds);
		if (delta === 0) {
			return;
		}

		let hasGrowingPlants = false;
		this.state.plots.forEach((plot) => {
			if (!plot.plant) return;
			const plant = plot.plant;
			if (plant.progress >= 1) return;

			hasGrowingPlants = true;
			const effectiveDuration = Math.max(1, plant.growthDuration / this.growthMultiplier);
			const increment = delta / effectiveDuration;
			plant.progress = Math.min(1, plant.progress + increment);
		});

		// Debug log when plants are growing
		if (hasGrowingPlants && Math.random() < 0.1) {
			// Log 10% of the time to avoid spam
			console.log(`[Tick] Multiplier: ${this.growthMultiplier.toFixed(1)}x`);
		}

		this.state.lastUpdatedAt = Date.now();

		if (!options.skipPersistence) {
			await this.persistAndNotify();
		} else {
			this.notify();
		}
	}

	private applyOfflineGrowth() {
		const now = Date.now();
		const elapsedMs = Math.max(0, now - this.state.lastUpdatedAt);
		if (elapsedMs === 0) return;
		const elapsedSeconds = elapsedMs / 1000;
		this.tick(elapsedSeconds, { skipPersistence: true }).catch((error) => {
			console.error("Failed to apply offline growth", error);
		});
	}

	private async persistAndNotify() {
		await this.enqueue(async () => {
			await this.persistState();
			this.notify();
		});
	}

	private async persistState() {
		this.state.lastUpdatedAt = Date.now();
		await this.storage.save(this.state);
	}

	private notify() {
		const snapshot = this.cloneState();
		this.listeners.forEach((listener) => {
			listener(snapshot);
		});
	}

	private cloneState(): GardenState {
		return JSON.parse(JSON.stringify(this.state)) as GardenState;
	}

	private enqueue(task: () => Promise<void>) {
		this.lock = this.lock.then(task, task);
		return this.lock;
	}
}
