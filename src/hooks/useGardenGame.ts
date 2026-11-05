import { useEffect, useRef, useState } from "react";
import { GardenGame, getSeedLibrary, type GardenState, type PlantType } from "../core/index";
import { createLocalStorageAdapter } from "../storage/localStorageAdapter";

type GameAction =
	| { type: "plant"; plotId: string; seedType: PlantType }
	| { type: "harvest"; plotId: string }
	| { type: "buySeed"; seedType: PlantType }
	| { type: "unlockPlot" }
	| { type: "setMultiplier"; value: number };

export interface GameError {
	message: string;
	type: GameAction["type"];
	plotId?: string;
}

export const useGardenGame = () => {
	const gameRef = useRef<GardenGame | null>(null);
	const [state, setState] = useState<GardenState | null>(null);
	const [isReady, setIsReady] = useState(false);
	const [error, setError] = useState<GameError | null>(null);
	const [multiplier, setMultiplier] = useState(1);

	useEffect(() => {
		let isMounted = true;

		const bootstrap = async () => {
			try {
				const storage = createLocalStorageAdapter();
				const game = await GardenGame.create(storage);
				if (!isMounted) return;
				gameRef.current = game;
				game.subscribe((nextState) => {
					setState(nextState);
				});
				setIsReady(true);
			} catch (err) {
				console.error("Failed to initialize GardenGame", err);
				if (isMounted) {
					setError({ message: "Unable to initialize garden", type: "plant" });
				}
			}
		};

		bootstrap().catch((err) => console.error(err));

		return () => {
			isMounted = false;
		};
	}, []);

	useEffect(() => {
		if (!isReady || !gameRef.current) return;
		const interval = window.setInterval(() => {
			// Don't override multiplier here - it's controlled by productivity score
			gameRef.current?.tick(1).catch((err) => console.error("Tick failed", err));
		}, 1000);

		return () => {
			window.clearInterval(interval);
		};
	}, [isReady]);

	const dispatch = async (action: GameAction) => {
		if (!gameRef.current) return;
		setError(null);

		try {
			switch (action.type) {
				case "plant":
					await gameRef.current.plantSeed(action.plotId, action.seedType);
					break;
				case "harvest":
					await gameRef.current.harvestCrop(action.plotId);
					break;
				case "buySeed":
					await gameRef.current.buySeed(action.seedType);
					break;
				case "unlockPlot":
					await gameRef.current.unlockPlot();
					break;
				case "setMultiplier":
					gameRef.current.setGrowthMultiplier(action.value);
					setMultiplier(action.value);
					console.log(`[Dispatch] Set multiplier to ${action.value}`);
					break;
				default:
					break;
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : "Something went wrong";
			const context: GameError = { message, type: action.type };
			if (action.type === "plant") {
				context.plotId = action.plotId;
			}
			setError(context);
		}
	};

	return {
		state,
		isReady,
		error,
		dispatch,
		seeds: getSeedLibrary(),
		multiplier,
	};
};
