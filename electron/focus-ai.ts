import type { WindowSummary } from "./focus-tracker";

interface BaseWeights {
	duration: number;
	switching: number;
	appContext: number;
	titleContext: number;
}

interface UserPatterns {
	productiveApps: Set<string>;
	distractingApps: Set<string>;
	learningApps: Set<string>;
	preferredSwitchingRate: number;
	averageSessionLength: number;
}

interface AIContext {
	category: string;
	multiplier: number;
	insight: string;
	context: string;
	confidence: number;
}

interface FocusScore {
	instantaneous: number;
	cumulative: number;
	baseScore: number;
	aiMultiplier: number;
	aiInsight: string;
	context: string;
	timestamp: number;
}

export class FocusAI {
	baseWeights: BaseWeights;
	userPatterns: UserPatterns;
	scoreHistory: number[];
	cumulativeScore: number;
	baseCumulativeOffset: number;
	maxPointsPerHour: number;
	maxPointsPerWindow: number;
	maxTotalPoints: number;
	baseRatePerMinute: number;
	contextMultipliers: {
		productive: number;
		neutral: number;
		distracted: number;
		idle: number;
	};
	aiEnabled: boolean;
	quotaExceeded: boolean;
	lastQuotaCheck: number;

	constructor() {
		console.log("🎯 FocusAI: Initializing with OLLAMA AI INTEGRATION");

		// Initialize basic settings
		this.aiEnabled = true;
		this.quotaExceeded = false;
		this.lastQuotaCheck = 0;

		// Removed keystroke and mouse tracking - using simplified scoring only

		// User learning data (simplified)
		this.userPatterns = {
			productiveApps: new Set(["Visual Studio Code", "Terminal", "Chrome", "Slack", "Notion", "Cursor"]),
			distractingApps: new Set(["Twitter", "Instagram", "Facebook", "TikTok"]),
			learningApps: new Set(["YouTube", "Coursera", "Khan Academy"]),
			preferredSwitchingRate: 0.5, // ideal switches per minute
			averageSessionLength: 25, // average session length in minutes
		};

		// Initialize missing properties
		this.baseWeights = {
			duration: 0.1,
			switching: 0.1,
			appContext: 0.45,
			titleContext: 0.35,
		};
		// At peak productivity (100 base score * 1.8 max AI multiplier), users earn 100 points/hour
		this.maxPointsPerHour = 100;
		this.maxPointsPerWindow = 25;

		// Score history for cumulative tracking
		this.scoreHistory = [];
		this.cumulativeScore = 0; // Starting score
		this.baseCumulativeOffset = 0; // Restored score baseline

		// Linear scoring engine: 1.67 points per focused minute
		// 1000 points = 10 hours of peak performance (600 minutes × 1.67 = 1000 points)
		this.baseRatePerMinute = 1.67; // Base rate for focused work
		this.maxTotalPoints = 1000; // 10 hours of peak performance

		// Context multipliers
		this.contextMultipliers = {
			productive: 1.0, // +1.0 for productive activities
			neutral: 0.5, // +0.5 for neutral activities (reduced from 0.7)
			distracted: 0.1, // +0.1 for distracting activities (reduced penalty)
			idle: 0.0, // 0.0 for idle time
		};
	}

	// Initialize Ollama connection
	async initializeOllama() {
		try {
			const response = await fetch("http://localhost:11434/api/tags");
			if (response.ok) {
				console.log("✅ Ollama connected successfully");
			} else {
				console.log("❌ Ollama not running - falling back to rule-based classification");
				this.aiEnabled = false;
			}
		} catch (error) {
			console.log("❌ Ollama connection failed - falling back to rule-based classification");
			this.aiEnabled = false;
		}
	}

	// AI context classification using Ollama
	async getAIContextCategory(activityWindow: WindowSummary): Promise<AIContext> {
		if (!this.aiEnabled) {
			return this.getRuleBasedClassification(activityWindow);
		}

		try {
			const prompt = `Analyze this activity and classify its productivity level:

App: ${activityWindow.activeApp || "Unknown"}
Title: ${activityWindow.windowTitle || "Unknown"}
URL: ${activityWindow.url || "None"}
Duration: ${(activityWindow.duration / 60000).toFixed(1)} minutes

Classify as one of these categories:
- "deep_work": Coding, writing, serious work (score 90-100)
- "learning": Educational content, tutorials, courses (score 70-85)
- "maintenance": General browsing, email, admin tasks (score 40-60)
- "distracted": Entertainment, social media, games (score 0-30)
- "idle": No activity or very low engagement (score 0-20)

Respond with ONLY this JSON format:
{"category": "category_name", "confidence": 0.85, "reasoning": "brief explanation"}`;

			const response = await fetch("http://localhost:11434/api/generate", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					model: "gemma3:4b",
					prompt: prompt,
					stream: false,
					options: {
						temperature: 0.1,
						top_p: 0.9,
						max_tokens: 200,
					},
				}),
			});

			if (!response.ok) {
				throw new Error(`Ollama API error: ${response.status}`);
			}

			const data = await response.json();
			const content = data.response || data.content || "";

			// Extract JSON from response
			const jsonMatch = content.match(/\{[\s\S]*\}/);
			if (jsonMatch) {
				const result = JSON.parse(jsonMatch[0]);
				return {
					category: result.category || "maintenance",
					confidence: result.confidence || 0.7,
					insight: result.reasoning || "AI analysis",
					context: result.category || "maintenance",
					multiplier: 1.0,
				};
			} else {
				// Fallback parsing
				const category = content.toLowerCase().includes("deep_work")
					? "deep_work"
					: content.toLowerCase().includes("learning")
					? "learning"
					: content.toLowerCase().includes("distracted")
					? "distracted"
					: content.toLowerCase().includes("idle")
					? "idle"
					: "maintenance";

				return {
					category,
					confidence: 0.6,
					insight: "AI analysis (parsed)",
					context: category,
					multiplier: 1.0,
				};
			}
		} catch (error) {
			console.log(`❌ Ollama AI analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`);
			return this.getRuleBasedClassification(activityWindow);
		}
	}

	async calculateHybridScore(activityWindow: WindowSummary): Promise<FocusScore> {
		console.log("🎯 calculateHybridScore called with:", activityWindow);

		// Get AI classification
		const aiContext = await this.getAIContextCategory(activityWindow);
		console.log(`🤖 AI Classification: ${aiContext.category} (${(aiContext.confidence * 100).toFixed(0)}%)`);

		// Calculate weighted score using new system (duration removed)
		const windowDurationMinutes = activityWindow.duration / 60000;
		const switchRate = activityWindow.switchRate || 0;

		// 1. Switching Score (20% weight) - penalty above 0.5 switches/min
		const switchingScore = Math.max(0, 100 - 40 * (switchRate - 0.5));

		// 2. App Context Score (50% weight) - MAJOR factor
		const appContextScore = this.calculateAppContextScore(activityWindow);

		// 3. Title/URL Context Score (30% weight) - MAJOR factor
		const titleContextScore = this.calculateTitleContextScore(activityWindow);

		// AI Multiplier based on classification
		const aiMultipliers: Record<string, number> = {
			deep_work: 1.8,
			learning: 1.5,
			maintenance: 1.0,
			distracted: 0.3,
			idle: 0.0,
		};

		const aiMultiplier = aiMultipliers[aiContext.category] || 1.0;

		// Weighted total score (0-100 scale) - duration removed, weights redistributed
		const totalScore = 0.2 * switchingScore + 0.5 * appContextScore + 0.3 * titleContextScore;

		// Apply AI multiplier
		const aiAdjustedScore = totalScore * aiMultiplier;

		// Scale so that 1 hour of maximum productivity = 100 points
		// Theoretical max: 100 (base) * 1.8 (max AI multiplier) = 180
		// We want 180 to map to 100 points/hour, so divide by 1.8
		const hoursActive = windowDurationMinutes / 60;
		const scaledScore = (aiAdjustedScore / 1.8) * hoursActive;

		console.log(`🔍 Weighted Score Calculation:`);
		console.log(`  - Switching: ${switchRate.toFixed(2)}/min → ${switchingScore.toFixed(1)} pts (20%)`);
		console.log(`  - App Context: ${appContextScore.toFixed(1)} pts (50%)`);
		console.log(`  - Title Context: ${titleContextScore.toFixed(1)} pts (30%)`);
		console.log(`  - Total Score: ${totalScore.toFixed(1)}/100`);
		console.log(`  - AI Multiplier: ${aiMultiplier.toFixed(1)}x (${aiContext.category})`);
		console.log(`  - AI Adjusted: ${aiAdjustedScore.toFixed(1)}`);
		console.log(`  - Scaled Score: ${scaledScore.toFixed(2)} pts (target: 100 pts/hr at peak)`);

		this.updateCumulativeScore(scaledScore);

		return {
			instantaneous: +scaledScore.toFixed(2),
			cumulative: +this.cumulativeScore.toFixed(2),
			baseScore: +totalScore.toFixed(2),
			aiMultiplier: +aiMultiplier.toFixed(2),
			aiInsight: aiContext.insight,
			context: aiContext.category,
			timestamp: Date.now(),
		};
	}

	// AI methods removed - using rule-based classification only

	countConsecutiveFocusMinutes(): number {
		// Simple implementation - return 0 for now
		return 0;
	}

	getRecentAverage(): number {
		// Simple implementation - return 0 for now
		return 0;
	}

	getRuleBasedClassification(activityWindow: WindowSummary): AIContext {
		const app = activityWindow.activeApp || "";
		const title = activityWindow.windowTitle || "";
		const url = activityWindow.url || "";

		// Simple rule-based classification
		if (!app || app === "null") {
			return {
				category: "idle",
				confidence: 0.8,
				insight: "No active application detected",
				context: "idle",
				multiplier: 0.0,
			};
		}

		const appLower = app.toLowerCase();
		const titleLower = title.toLowerCase();
		const urlLower = url.toLowerCase();

		// Deep work applications
		if (
			appLower.includes("cursor") ||
			appLower.includes("vscode") ||
			appLower.includes("code") ||
			appLower.includes("sublime") ||
			appLower.includes("atom") ||
			appLower.includes("vim") ||
			appLower.includes("emacs")
		) {
			return {
				category: "deep_work",
				confidence: 0.9,
				insight: "Using productive development tool",
				context: "deep_work",
				multiplier: 1.8,
			};
		}

		// Learning platforms
		if (
			urlLower.includes("khan") ||
			urlLower.includes("coursera") ||
			urlLower.includes("edx") ||
			urlLower.includes("udemy") ||
			(urlLower.includes("youtube") &&
				(titleLower.includes("tutorial") || titleLower.includes("course") || titleLower.includes("learn")))
		) {
			return {
				category: "learning",
				confidence: 0.8,
				insight: "Educational content detected",
				context: "learning",
				multiplier: 1.5,
			};
		}

		// Research tools
		if (
			appLower.includes("chrome") ||
			appLower.includes("firefox") ||
			appLower.includes("safari") ||
			appLower.includes("edge")
		) {
			if (
				urlLower.includes("wikipedia") ||
				urlLower.includes("stackoverflow") ||
				urlLower.includes("github") ||
				urlLower.includes("docs")
			) {
				return {
					category: "learning",
					confidence: 0.7,
					insight: "Research and documentation",
					context: "learning",
					multiplier: 1.5,
				};
			}
			return {
				category: "maintenance",
				confidence: 0.6,
				insight: "General web browsing",
				context: "maintenance",
				multiplier: 1.0,
			};
		}

		// Distracting applications
		if (
			appLower.includes("instagram") ||
			appLower.includes("tiktok") ||
			appLower.includes("facebook") ||
			appLower.includes("twitter") ||
			appLower.includes("reddit") ||
			appLower.includes("discord")
		) {
			return {
				category: "distracted",
				confidence: 0.9,
				insight: "Social media or entertainment",
				context: "distracted",
				multiplier: 0.3,
			};
		}

		// Default to maintenance
		return {
			category: "maintenance",
			confidence: 0.6,
			insight: "General application usage",
			context: "maintenance",
			multiplier: 1.0,
		};
	}

	// calculateBaseScore method removed - using new weighted system in calculateHybridScore

	calculateAppContextScore(activityWindow: WindowSummary): number {
		const app = activityWindow.activeApp?.toLowerCase() || "";
		const url = typeof activityWindow.url === "string" ? activityWindow.url.toLowerCase() : "";

		// Deep work applications - MAXIMUM productivity
		if (
			app.includes("cursor") ||
			app.includes("vscode") ||
			app.includes("code") ||
			app.includes("sublime") ||
			app.includes("atom") ||
			app.includes("vim") ||
			app.includes("emacs") ||
			app.includes("terminal")
		) {
			return 100; // Maximum productivity
		}

		// Learning platforms - HIGH productivity
		if (
			url.includes("khan") ||
			url.includes("coursera") ||
			url.includes("edx") ||
			url.includes("udemy") ||
			url.includes("stackoverflow") ||
			url.includes("github") ||
			url.includes("docs") ||
			url.includes("wikipedia")
		) {
			return 90; // High productivity
		}

		// YouTube - conditionally productive
		if (url.includes("youtube")) {
			const title = activityWindow.windowTitle?.toLowerCase() || "";
			// Educational keywords
			if (
				title.includes("tutorial") ||
				title.includes("course") ||
				title.includes("learn") ||
				title.includes("how to") ||
				title.includes("lecture") ||
				title.includes("education") ||
				title.includes("math") ||
				title.includes("science") ||
				title.includes("programming") ||
				title.includes("coding")
			) {
				return 80; // Moderately productive
			}
			return 5; // Very low productivity for entertainment
		}

		// General browsers - NEUTRAL
		if (app.includes("chrome") || app.includes("firefox") || app.includes("safari") || app.includes("edge")) {
			return 50; // Neutral productivity
		}

		// Distracting applications - MINIMUM productivity
		if (
			app.includes("instagram") ||
			app.includes("tiktok") ||
			app.includes("facebook") ||
			app.includes("twitter") ||
			app.includes("reddit") ||
			app.includes("discord") ||
			app.includes("netflix") ||
			app.includes("spotify")
		) {
			return 0; // No productivity
		}

		// Default for unknown apps
		return 30;
	}

	calculateTitleContextScore(activityWindow: WindowSummary): number {
		const title = activityWindow.windowTitle?.toLowerCase() || "";
		const url = typeof activityWindow.url === "string" ? activityWindow.url.toLowerCase() : "";

		let score = 30; // Lower base score

		// Educational/academic keywords - BIG BOOST
		const educationalKeywords = [
			"tutorial",
			"course",
			"learn",
			"study",
			"education",
			"academic",
			"math",
			"calculus",
			"algebra",
			"science",
			"physics",
			"chemistry",
			"programming",
			"coding",
			"development",
			"algorithm",
			"data",
			"research",
			"analysis",
			"documentation",
			"guide",
			"manual",
		];

		// Entertainment keywords - BIG PENALTY
		const entertainmentKeywords = [
			"funny",
			"comedy",
			"entertainment",
			"music",
			"movie",
			"game",
			"social",
			"chat",
			"messaging",
			"news",
			"gossip",
			"celebrity",
			"kids",
			"strongest",
			"dollar",
			"food",
			"week",
			"ate",
			"explosion",
		];

		// Check for educational content - BIG REWARD
		for (const keyword of educationalKeywords) {
			if (title.includes(keyword) || url.includes(keyword)) {
				score += 50; // Much bigger boost
				break;
			}
		}

		// Check for entertainment content - BIG PENALTY
		for (const keyword of entertainmentKeywords) {
			if (title.includes(keyword) || url.includes(keyword)) {
				score -= 40; // Much bigger penalty
				break;
			}
		}

		// Cap score between 0-100
		return Math.max(0, Math.min(100, score));
	}

	generateContextualInsight(activityWindow: WindowSummary, totalScore: number): string {
		const app = activityWindow.activeApp || "Unknown App";
		const title = activityWindow.windowTitle || "Unknown Window";
		const duration = (activityWindow.duration / 60000).toFixed(1);
		const switchRate = activityWindow.switchRate?.toFixed(2) || "0";

		// Determine productivity level
		let productivityLevel = "Low";
		if (totalScore >= 80) productivityLevel = "Excellent";
		else if (totalScore >= 60) productivityLevel = "Good";
		else if (totalScore >= 40) productivityLevel = "Moderate";
		else if (totalScore >= 20) productivityLevel = "Low";
		else productivityLevel = "Very Low";

		// Generate contextual insight
		if (app.toLowerCase().includes("cursor") || app.toLowerCase().includes("code")) {
			return `Spent ${duration}min coding in ${app}. ${productivityLevel} focus (${totalScore.toFixed(
				0
			)}/100). Switch rate: ${switchRate}/min.`;
		}

		if (typeof activityWindow.url === "string" && activityWindow.url.includes("youtube")) {
			const isEducational =
				title.toLowerCase().includes("tutorial") ||
				title.toLowerCase().includes("course") ||
				title.toLowerCase().includes("learn") ||
				title.toLowerCase().includes("math") ||
				title.toLowerCase().includes("calculus");

			if (isEducational) {
				return `Watched ${duration}min of educational content: "${title}". ${productivityLevel} productivity (${totalScore.toFixed(
					0
				)}/100).`;
			} else {
				return `Watched ${duration}min of entertainment: "${title}". ${productivityLevel} productivity (${totalScore.toFixed(
					0
				)}/100).`;
			}
		}

		if (
			typeof activityWindow.url === "string" &&
			(activityWindow.url.includes("github") || activityWindow.url.includes("stackoverflow"))
		) {
			return `Spent ${duration}min on development resources. ${productivityLevel} productivity (${totalScore.toFixed(
				0
			)}/100).`;
		}

		// Generic insight
		return `Used ${app} for ${duration}min. ${productivityLevel} productivity (${totalScore.toFixed(
			0
		)}/100). Switch rate: ${switchRate}/min.`;
	}

	getRuleBasedContext(activityWindow: WindowSummary): AIContext {
		const app = activityWindow.activeApp || "";
		const title = activityWindow.windowTitle || "";
		const url = activityWindow.url || "";
		const focusRatio = activityWindow.focusRatio || 0;

		// Determine context category and apply appropriate multiplier
		let contextCategory: keyof typeof this.contextMultipliers = "neutral";
		let multiplier = this.contextMultipliers.neutral;
		let insight = "Standard productivity tracking";
		let context = "Working";

		// Check if user is idle
		if (focusRatio < 0.1) {
			contextCategory = "idle";
			multiplier = this.contextMultipliers.idle;
			insight = "User appears to be idle";
			context = "Idle";
		}
		// Enhanced content analysis using title and URL
		else {
			const titleLower = title.toLowerCase();
			const urlLower = url.toLowerCase();

			// Educational content detection
			const educationalKeywords = [
				"tutorial",
				"course",
				"lesson",
				"how to",
				"explained",
				"guide",
				"learn",
				"calculus",
				"mathematics",
				"physics",
				"chemistry",
				"biology",
				"programming",
				"python",
				"javascript",
				"coding",
				"algorithm",
				"data structure",
				"machine learning",
				"khan academy",
				"coursera",
				"edx",
				"mit",
				"stanford",
				"university",
				"academic",
			];

			// Entertainment content detection
			const entertainmentKeywords = [
				"funny",
				"viral",
				"reaction",
				"prank",
				"challenge",
				"compilation",
				"cat",
				"celebrity",
				"gossip",
				"music video",
				"gaming",
				"gameplay",
				"entertainment",
				"cooking",
				"recipe",
				"food",
				"lifestyle",
				"vlog",
				"unboxing",
				"review",
			];

			// Professional/work content detection
			const professionalKeywords = [
				"meeting",
				"conference",
				"webinar",
				"presentation",
				"documentation",
				"api",
				"documentation",
				"manual",
				"research",
				"analysis",
				"business",
			];

			// Count educational vs entertainment keywords
			const educationalScore = educationalKeywords.reduce(
				(score, keyword) =>
					score + (titleLower.includes(keyword) ? 1 : 0) + (urlLower.includes(keyword) ? 0.5 : 0),
				0
			);

			const entertainmentScore = entertainmentKeywords.reduce(
				(score, keyword) =>
					score + (titleLower.includes(keyword) ? 1 : 0) + (urlLower.includes(keyword) ? 0.5 : 0),
				0
			);

			const professionalScore = professionalKeywords.reduce(
				(score, keyword) =>
					score + (titleLower.includes(keyword) ? 1 : 0) + (urlLower.includes(keyword) ? 0.5 : 0),
				0
			);

			// Determine content type based on scores
			if (educationalScore > entertainmentScore && educationalScore > 0) {
				contextCategory = "productive";
				multiplier = Math.min(2.0, 1.0 + educationalScore * 0.2);
				insight = `Educational content detected: ${title.substring(0, 50)}...`;
				context = "Educational learning";
			} else if (professionalScore > 0) {
				contextCategory = "productive";
				multiplier = this.contextMultipliers.productive;
				insight = "Professional or work-related content";
				context = "Professional development";
			} else if (entertainmentScore > educationalScore && entertainmentScore > 0) {
				contextCategory = "distracted";
				multiplier = Math.max(0.1, 0.5 - entertainmentScore * 0.1);
				insight = `Entertainment content detected: ${title.substring(0, 50)}...`;
				context = "Entertainment";
			} else if (this.userPatterns.productiveApps.has(app)) {
				contextCategory = "productive";
				multiplier = this.contextMultipliers.productive;
				insight = "Using productive application";
				context = "Focused work";
			} else if (this.userPatterns.distractingApps.has(app)) {
				contextCategory = "distracted";
				multiplier = this.contextMultipliers.distracted;
				insight = "Using potentially distracting app";
				context = "Social media or entertainment";
			}
		}

		return {
			category: contextCategory,
			multiplier: multiplier,
			insight: insight,
			context: context,
			confidence: 0.6,
		};
	}

	applyAIMultiplier(baseScore: number, aiContext: AIContext): number {
		// Apply context multiplier to base score
		const multiplier = aiContext.multiplier;
		const confidence = aiContext.confidence || 0.8;

		// Adjust multiplier based on AI confidence
		// Lower confidence = more conservative scoring
		const confidenceAdjustedMultiplier = 1.0 + (multiplier - 1.0) * confidence;
		const adjustedScore = baseScore * confidenceAdjustedMultiplier;

		// Apply smoothing for human-like, gradual score changes
		// This prevents jarring jumps in productivity scores
		const smoothingFactor = 0.4; // 40% of the change applied immediately
		const smoothedScore = baseScore + (adjustedScore - baseScore) * smoothingFactor;

		// Ensure score doesn't go negative (except for distracting activities)
		const finalScore = Math.max(0, smoothedScore);

		console.log(
			`🎯 Score Application: base=${baseScore.toFixed(2)}, multiplier=${multiplier.toFixed(
				2
			)}, confidence=${confidence.toFixed(2)}, final=${finalScore.toFixed(2)}`
		);

		return finalScore;
	}

	updateCumulativeScore(instantaneousScore: number) {
		this.scoreHistory.push(instantaneousScore);

		// Keep only last 200 scores (10 hours of data: 200 windows × 3 minutes)
		if (this.scoreHistory.length > 200) {
			this.scoreHistory.shift();
		}

		// Calculate total cumulative score: restored baseline + sum of new points
		const earnedSinceRestore = this.scoreHistory.reduce((sum, score) => sum + score, 0);
		this.cumulativeScore = this.baseCumulativeOffset + earnedSinceRestore;

		// Ensure cumulative score doesn't exceed maximum
		this.cumulativeScore = Math.min(this.maxTotalPoints, this.cumulativeScore);
	}

	getFallbackScore(activityWindow: WindowSummary): FocusScore {
		// Simple fallback calculation with proper scaling
		const windowDurationMinutes = activityWindow.duration / 60000;
		const hoursActive = windowDurationMinutes / 60;

		// Use neutral productivity: 50/100 base score, 1.0 AI multiplier
		// Scaled to 100 pts/hr at peak: (50 * 1.0 / 1.8) * hoursActive
		const baseScore = (50 / 1.8) * hoursActive;

		this.updateCumulativeScore(baseScore);

		return {
			instantaneous: Math.round(baseScore * 100) / 100, // Round to 2 decimal places
			cumulative: Math.round(this.cumulativeScore * 100) / 100,
			baseScore: Math.round(baseScore * 100) / 100,
			aiMultiplier: 1.0,
			aiInsight: "Using rule-based analysis",
			context: "Standard productivity tracking",
			timestamp: Date.now(),
		};
	}

	getGardenGrowthLevel(): string {
		// Map cumulative score to garden growth stages (0-1000 scale)
		if (this.cumulativeScore < 100) return "soil"; // 0-100 points
		if (this.cumulativeScore < 300) return "seed"; // 100-300 points
		if (this.cumulativeScore < 500) return "sprout"; // 300-500 points
		if (this.cumulativeScore < 750) return "plant"; // 500-750 points
		return "bloom"; // 750-1000 points
	}

	/**
	 * Restore cumulative score from database (called on app startup)
	 */
	restoreCumulativeScore(score: number): void {
		this.baseCumulativeOffset = Math.max(0, score); // Ensure non-negative
		// Recompute cumulative with current history over the new baseline
		const earnedSinceRestore = this.scoreHistory.reduce((sum, s) => sum + s, 0);
		this.cumulativeScore = Math.min(this.maxTotalPoints, this.baseCumulativeOffset + earnedSinceRestore);
		console.log(`🔄 FocusAI: Cumulative score restored to ${this.cumulativeScore}`);
	}
}

export type { AIContext, FocusScore };
