export type PlantType = "seedling" | "blossom" | "evergreen" | "rose" | "lavender" | "beanstalk" | "sixtyseven";

export interface Plant {
	id: string;
	type: PlantType;
	plantedAt: number;
	growthDuration: number;
	progress: number;
}

export interface Plot {
	id: string;
	plant: Plant | null;
}

export interface Inventory {
	currency: number;
	seeds: Record<PlantType, number>;
	decorations: string[];
}

export interface GardenState {
	plots: Plot[];
	inventory: Inventory;
	lastUpdatedAt: number;
}

export const createInitialGardenState = (): GardenState => ({
	plots: Array.from({ length: 4 }, (_, index) => ({
		id: `plot-${index + 1}`,
		plant: null,
	})),
	inventory: {
		currency: 0,
		seeds: {
			seedling: 3,
			blossom: 1,
			evergreen: 0,
			rose: 0,
			lavender: 0,
			beanstalk: 0,
			sixtyseven: 0,
		},
		decorations: [],
	},
	lastUpdatedAt: Date.now(),
});

export {
	GardenGame,
	SEED_LIBRARY,
	getGrowthConfig,
	getSeedLibrary,
	resetGrowthConfig,
	setGrowthConfig,
	type GardenStorage,
	type GrowthConfig,
	type SeedDefinition,
} from "./gardenGame";
