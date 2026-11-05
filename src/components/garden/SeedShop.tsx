import type { Inventory, PlantType, SeedDefinition } from "../../core/index";

interface SeedShopProps {
	seeds: Record<PlantType, SeedDefinition>;
	inventory: Inventory;
	onBuySeed: (seedType: PlantType) => void;
	onClose?: () => void;
}

const DRAG_TYPE = "application/seed-type";

export const SeedShop = ({ seeds, inventory, onBuySeed, onClose }: SeedShopProps) => {
	const handleDragStart =
		(seedType: PlantType): React.DragEventHandler<HTMLDivElement> =>
		(event) => {
			event.dataTransfer.effectAllowed = "copy";
			event.dataTransfer.setData(DRAG_TYPE, seedType);
		};

	return (
		<section className="seed-shop">
			<header>
				<h2>Seed Shop</h2>
				<p>Drag seeds onto plots or purchase more using your garden coins.</p>
				{onClose && (
					<button type="button" className="seed-shop__close" onClick={onClose}>
						Close
					</button>
				)}
			</header>
			<div className="seed-shop__list">
				{Object.values(seeds).map((seed) => {
					const ownedCount = inventory.seeds[seed.type] ?? 0;
					const canAfford = inventory.currency >= seed.seedCost;

					return (
						<div key={seed.type} className="seed-card" draggable onDragStart={handleDragStart(seed.type)}>
							<div className="seed-card__header">
								<h3>{seed.displayName}</h3>
								<span className="seed-card__type">{seed.type.toUpperCase()}</span>
							</div>
							<p className="seed-card__description">{seed.description}</p>
							<ul className="seed-card__stats">
								<li>
									<strong>Duration:</strong> {seed.growthDuration / 60} min
								</li>
								<li>
									<strong>Reward:</strong> {seed.harvestReward} coins
								</li>
							</ul>
							<footer>
								<span className="seed-card__owned">Owned: {ownedCount}</span>
								<button
									type="button"
									disabled={!canAfford}
									onClick={() => onBuySeed(seed.type)}
									className="seed-card__buy"
									aria-label={`Buy for ${seed.seedCost} coins`}
								>
									<span className="coin-icon" aria-hidden="true" />
									<span className="coin-amount">{seed.seedCost}</span>
								</button>
							</footer>
						</div>
					);
				})}
			</div>
		</section>
	);
};
