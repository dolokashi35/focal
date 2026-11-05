export interface FocusData {
	instantaneous: number;
	cumulative: number;
	aiInsight: string;
	context: string;
	activeApp: string | null;
	windowTitle: string | null;
	url: string | null;
	switchRate: number;
	keystrokeRate: number;
	timestamp: number;
}

export interface OverlayData {
	windowTitle: string | null;
	url: string | null;
	keystrokeCount?: number;
	keystrokeRate?: number;
	mouseMovements?: number;
	mouseMovementRate?: number;
	instantaneous?: number;
	cumulative?: number;
	aiInsight?: string;
	context?: string;
	timestamp: number;
}

export interface SessionData {
	startTime: number;
}

export interface ScoreResponse {
	success: boolean;
	score?: number;
	error?: string;
}

export interface UpdateScoreResponse {
	success: boolean;
	error?: string;
}
