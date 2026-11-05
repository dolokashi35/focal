import clsx from "clsx";
import type { Plant } from "../../core/index";

export const getStageLabel = (plant: Plant) => {
	if (plant.progress >= 1) return "Ready to Harvest";
	if (plant.progress >= 0.66) return "Blooming";
	if (plant.progress >= 0.33) return "Sprouting";
	return "Seedling";
};

interface PlantVisualProps {
	plant: Plant;
	stageLabel: string;
	iconSrc?: string;
	displayName?: string;
	className?: string;
}

export const PlantVisual = ({ plant, stageLabel, iconSrc, displayName, className }: PlantVisualProps) => {
	const scale = 0.7 + plant.progress * 0.35;
	const swayIntensity = plant.progress >= 1 ? "plot-plant--harvest-ready" : "plot-plant--growing";
	const clampedProgress = Math.min(Math.max(plant.progress, 0), 1);
	const revealTopInset = `${(1 - clampedProgress) * 100}%`;
	const clipPath = `inset(${revealTopInset} 0 0 0)`;
	const stageKey = stageLabel.replace(/\s+/g, "").toLowerCase();
	const isIllustrated = Boolean(iconSrc);

	return (
		<div
			className={clsx("plot-plant", swayIntensity, { "plot-plant--illustrated": isIllustrated }, className)}
			style={{ transform: `scale(${scale})` }}
		>
			<div
				className={clsx("plot-plant__reveal", {
					"plot-plant__reveal--illustrated": isIllustrated,
				})}
				style={{ clipPath }}
			>
				{iconSrc ? (
					<>
						<span className="plot-plant__glow" aria-hidden="true" />
						<img src={iconSrc} alt={displayName ?? stageLabel} className="plot-plant__image" />
					</>
				) : (
					<>
						<div className={clsx("plot-plant__stem", `plot-plant__stem--${plant.type}`)} />
						<div className={clsx("plot-plant__bloom", `plot-plant__bloom--${stageKey}`)} />
					</>
				)}
			</div>
		</div>
	);
};
