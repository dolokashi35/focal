/**
 * Types for productivity intelligence and context analysis
 */

export interface ScreenContext {
	activeApp: string | null;
	windowTitle: string | null;
	url: string | null;
	timestamp: number;
}

export interface HistoricalContext {
	screens: ScreenContext[];
	switchCount: number;
	totalDuration: number;
}

export interface ProductivityAnalysis {
	contextRelation: "focused" | "research" | "maintenance" | "distracted" | "idle";
	productivityLevel: "productive" | "neutral" | "distracting" | "idle";
	weightMultiplier: number;
	insight: string;
}

export interface BedrockConfig {
	apiKey: string;
	region?: string;
	model?: string;
}

export interface AIRequestPayload {
	currentScreen: ScreenContext;
	recentScreens: ScreenContext[];
	userPrompt: string;
}
