import { useCallback, useEffect, useState } from "react";
import { getPlantIconSrc } from "../assets/plantIcons";
import { getSeedLibrary } from "../core/gardenGame";
import type { Plant, PlantType } from "../core/index";
import { PlantVisual, getStageLabel } from "./garden/PlantVisual";
import "./PlantOverlayWindow.css";
import type { IpcRenderer, IpcRendererEvent } from "electron";

interface PlantData {
	plantId: string;
	plotId: string;
	plantType: PlantType;
	progress: number;
	plantedAt: number;
	growthDuration: number;
}

const PlantOverlayWindow = () => {
	const [plantData, setPlantData] = useState<PlantData | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

	const getIpcRenderer = (): IpcRenderer | null => {
		const w = window as unknown as { require?: (m: string) => { ipcRenderer?: IpcRenderer } };
		try {
			return w.require?.("electron")?.ipcRenderer ?? null;
		} catch {
			return null;
		}
	};

	useEffect(() => {
		const ipcRenderer = getIpcRenderer();
		if (!ipcRenderer) return;

		const handlePlantData = (_event: IpcRendererEvent, data: PlantData | null) => {
			setPlantData(data);
		};

		ipcRenderer.on("plant-data-update", handlePlantData);

		return () => {
			ipcRenderer.removeListener("plant-data-update", handlePlantData);
		};
	}, []);

	const handleMouseDown = (e: React.MouseEvent) => {
		if (e.button !== 0) return; // Only left mouse button

		setIsDragging(true);
		const bounds = (e.currentTarget as HTMLElement).getBoundingClientRect();
		setDragOffset({
			x: e.clientX - bounds.left,
			y: e.clientY - bounds.top,
		});

		// Disable text selection during drag
		e.preventDefault();
	};

	const handleMouseMove = useCallback(
		(e: MouseEvent) => {
			if (!isDragging) return;
			const ipcRenderer = getIpcRenderer();
			if (ipcRenderer) {
				const newX = e.screenX - dragOffset.x;
				const newY = e.screenY - dragOffset.y;
				ipcRenderer.send("plant-overlay-move", { x: newX, y: newY });
			}
		},
		[isDragging, dragOffset]
	);

	const handleMouseUp = useCallback(() => {
		setIsDragging(false);
	}, []);

	useEffect(() => {
		if (isDragging) {
			document.addEventListener("mousemove", handleMouseMove);
			document.addEventListener("mouseup", handleMouseUp);
			return () => {
				document.removeEventListener("mousemove", handleMouseMove);
				document.removeEventListener("mouseup", handleMouseUp);
			};
		}
		return undefined;
	}, [isDragging, handleMouseMove, handleMouseUp]);

	const plant: Plant | null = plantData
		? {
			id: plantData.plantId,
			type: plantData.plantType,
			plantedAt: plantData.plantedAt,
			growthDuration: plantData.growthDuration,
			progress: plantData.progress,
		}
		: null;

	const seedLibrary = getSeedLibrary();
	const definition = plant ? seedLibrary[plant.type] : undefined;
	const iconSrc = definition ? getPlantIconSrc(definition.icon) : undefined;
	const stageLabel = plant ? getStageLabel(plant) : "";

	return (
		<div className="plant-overlay-root" onMouseDown={handleMouseDown} style={{ cursor: isDragging ? "grabbing" : "grab" }}>
			{plant ? (
				<PlantVisual
					plant={plant}
					stageLabel={stageLabel}
					iconSrc={iconSrc}
					displayName={definition?.displayName}
					className="plant-overlay-plant"
				/>
			) : null}
		</div>
	);
};

export default PlantOverlayWindow;
