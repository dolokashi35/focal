import clsx from "clsx";
import { useCallback } from "react";
import type { SeedDefinition } from "../../core/gardenGame";
import type { GardenState, PlantType } from "../../core/index";

interface InventoryToolbarProps {
	state: GardenState;
	seeds: Record<PlantType, SeedDefinition>;
	multiplier: number;
	isSeedShopOpen: boolean;
	onToggleSeedShop: () => void;
}

const formatMinutes = (seconds: number) => {
	const minutes = seconds / 60;
	if (minutes < 1) return `${seconds}s`;
	if (Number.isInteger(minutes)) return `${minutes} min`;
	return `${minutes.toFixed(1)} min`;
};

const DRAG_TYPE = "application/seed-type";

export const InventoryToolbar = ({
	state,
	seeds,
	multiplier,
	isSeedShopOpen,
	onToggleSeedShop,
}: InventoryToolbarProps) => {
	const { currency, seeds: inventorySeeds } = state.inventory;

	const handleWheel: React.WheelEventHandler<HTMLDivElement> = useCallback((event) => {
		if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
			return;
		}
		event.preventDefault();
		event.currentTarget.scrollLeft += event.deltaY;
	}, []);

	const handleDragStart =
		(seedType: PlantType): React.DragEventHandler<HTMLDivElement> =>
		(event) => {
			event.dataTransfer.effectAllowed = "copy";
			event.dataTransfer.setData(DRAG_TYPE, seedType);
		};

	return (
		<footer className="inventory-toolbar" aria-label="Inventory toolbar">
			<div className="inventory-toolbar__rail">
				<div className="inventory-toolbar__seeds" onWheel={handleWheel}>
					{Object.values(seeds).map((seed) => {
						const count = inventorySeeds[seed.type] ?? 0;
						const isEmpty = count <= 0;

						return (
							<div
								key={seed.type}
								className={clsx("inventory-toolbar__seed", {
									"inventory-toolbar__seed--empty": isEmpty,
								})}
								draggable={!isEmpty}
								onDragStart={!isEmpty ? handleDragStart(seed.type) : undefined}
								title={`${seed.displayName} | ${formatMinutes(seed.growthDuration)} | +${
									seed.harvestReward
								} coins`}
							>
								<span className="inventory-toolbar__seed-count">{count}</span>
								<div className="inventory-toolbar__seed-info">
									<span className="inventory-toolbar__seed-name">{seed.displayName}</span>
									<span className="inventory-toolbar__seed-meta">
										<span className="inventory-toolbar__seed-meta-time">
											<span className="inventory-toolbar__clock-icon" aria-hidden="true" />
											{formatMinutes(seed.growthDuration)}
										</span>
										<span className="inventory-toolbar__seed-meta-reward">
											<span className="inventory-toolbar__seed-coin-icon" aria-hidden="true" />+
											{seed.harvestReward}
										</span>
									</span>
								</div>
							</div>
						);
					})}
				</div>

				<div className="inventory-toolbar__side">
					<button
						type="button"
						className="app__toggle-button app__toggle-button--filled inventory-toolbar__shop"
						onClick={onToggleSeedShop}
					>
						{isSeedShopOpen ? "Close Seed Shop" : "Open Seed Shop"}
					</button>
					<div className="inventory-toolbar__status">
						<div className="inventory-toolbar__coins" aria-label="Garden coins">
							<span className="inventory-toolbar__coin-icon" aria-hidden="true" />
							<span className="inventory-toolbar__coin-amount">{currency}</span>
						</div>
						<div className="inventory-toolbar__multiplier" aria-label="Growth multiplier">
							<span>Growth</span>
							<strong>{multiplier.toFixed(2)}x</strong>
						</div>
					</div>
				</div>
			</div>
		</footer>
	);
};
