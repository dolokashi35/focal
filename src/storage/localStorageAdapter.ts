import type { GardenStorage } from "../core/gardenGame";
import { createInitialGardenState, type GardenState } from "../core/index";

const STORAGE_KEY = "garden-productivity-state";

export const createLocalStorageAdapter = (): GardenStorage => ({
	async load() {
		if (typeof window === "undefined") {
			return createInitialGardenState();
		}

		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return createInitialGardenState();
		}

		try {
			const parsed = JSON.parse(raw) as GardenState;
			return parsed;
		} catch (error) {
			console.warn("Failed to parse garden state from localStorage", error);
			return createInitialGardenState();
		}
	},
	async save(state) {
		if (typeof window === "undefined") {
			return;
		}

		const payload: GardenState = {
			...state,
			lastUpdatedAt: Date.now(),
		};
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
	},
});
