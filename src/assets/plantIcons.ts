const iconModules = import.meta.glob("./plants/*.svg", {
	eager: true,
	import: "default",
}) as Record<string, string>;

const iconMap: Record<string, string> = Object.entries(iconModules).reduce((acc, [path, value]) => {
	const fileName = path.split("/").pop();
	if (fileName) {
		acc[fileName] = value;
	}
	return acc;
}, {} as Record<string, string>);

export const getPlantIconSrc = (fileName: string | undefined) => {
	if (!fileName) return undefined;
	return iconMap[fileName];
};

export const hasPlantIcon = (fileName: string | undefined) => Boolean(fileName && iconMap[fileName]);
