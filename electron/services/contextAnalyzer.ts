/**
 * Context Analyzer Service
 * Uses AWS Bedrock to analyze focus context and productivity
 */

import { BedrockClient } from "./bedrockClient";
import { BedrockConfig, ProductivityAnalysis, ScreenContext } from "./types";

export class ContextAnalyzer {
	private bedrockClient: BedrockClient | null = null;
	private isEnabled: boolean = false;

	constructor(config: BedrockConfig) {
		try {
			this.bedrockClient = new BedrockClient(config);
			this.isEnabled = this.bedrockClient.isInitialized();
			console.log("✅ Context Analyzer initialized");
		} catch (error: any) {
			console.error("❌ Context Analyzer initialization failed:", error.message);
			this.isEnabled = false;
			this.bedrockClient = null;
		}
	}

	/**
	 * Analyze the current screen context and recent history to determine
	 * productivity level and contextual relationship
	 */
	async analyzeContext(currentScreen: ScreenContext, recentScreens: ScreenContext[]): Promise<ProductivityAnalysis> {
		if (!this.isEnabled || !this.bedrockClient) {
			return this.getFallbackAnalysis(currentScreen);
		}

		try {
			const prompt = this.buildAnalysisPrompt(currentScreen, recentScreens);
			const response = await this.bedrockClient.invokeModel(prompt, 512);

			// Parse the JSON response
			const analysis = this.parseAnalysisResponse(response);

			console.log("🧠 AI Context Analysis:", analysis);
			return analysis;
		} catch (error: any) {
			console.error("❌ Context analysis failed:", error.message);
			return this.getFallbackAnalysis(currentScreen);
		}
	}

	/**
	 * Build the analysis prompt for the AI model
	 */
	private buildAnalysisPrompt(currentScreen: ScreenContext, recentScreens: ScreenContext[]): string {
		const prompt = `You are a productivity intelligence model that evaluates a user's focus context. Analyze the current screen and the last three screens to determine both (1) how contextually related this task switch is, and (2) whether the current activity is productive, neutral, or distracting.

Consider the application names, window titles, and URLs semantically — not just by keywords. If the current task continues the same workflow (e.g., VS Code → Chrome → Stack Overflow), it shows high contextual focus. If the user switches to something unrelated or entertainment-based (e.g., VS Code → YouTube → TikTok), it indicates distraction.

Evaluate educational content (e.g., "Khan Academy," "Machine Learning Course") as productive learning, and professional or creative tools (VS Code, Notion, Slack, Docs) as work.

**Current Screen:**
- Application: ${currentScreen.activeApp || "Unknown"}
- Window Title: ${currentScreen.windowTitle || "Unknown"}
- URL: ${currentScreen.url || "N/A"}
- Timestamp: ${new Date(currentScreen.timestamp).toLocaleTimeString()}

**Last 3 Screens:**
${recentScreens
	.slice(-3)
	.map((screen, idx) => {
		return `${idx + 1}. Application: ${screen.activeApp || "Unknown"}
   Window Title: ${screen.windowTitle || "Unknown"}
   URL: ${screen.url || "N/A"}
   Timestamp: ${new Date(screen.timestamp).toLocaleTimeString()}`;
	})
	.join("\n\n")}

**Guidelines:**
- Deep or related work → 1.5–2.0 multiplier, "productive"
- Educational or research tasks → 1.2–1.5 multiplier, "productive"
- Routine admin tasks → 0.9–1.1 multiplier, "neutral"
- Unrelated or entertainment content → 0.2–0.7 multiplier, "distracting"
- Idle / no activity → 0.0–0.3 multiplier, "idle"

Use reasoning and context across screens to produce consistent, meaningful scores.

Respond ONLY in strict JSON format (no markdown, no code blocks, just raw JSON):

{
  "contextRelation": "[focused|research|maintenance|distracted|idle]",
  "productivityLevel": "[productive|neutral|distracting|idle]",
  "weightMultiplier": [0.1-2.0],
  "insight": "[one concise reason for this score]"
}`;

		return prompt;
	}

	/**
	 * Parse the AI model's response into a ProductivityAnalysis object
	 */
	private parseAnalysisResponse(response: string): ProductivityAnalysis {
		try {
			// Clean up the response - remove any markdown code blocks or extra whitespace
			let cleanedResponse = response.trim();

			// Remove markdown code blocks if present
			if (cleanedResponse.startsWith("```")) {
				cleanedResponse = cleanedResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "");
			}

			// Parse the JSON
			const parsed = JSON.parse(cleanedResponse);

			// Validate the structure
			if (
				!parsed.contextRelation ||
				!parsed.productivityLevel ||
				typeof parsed.weightMultiplier !== "number" ||
				!parsed.insight
			) {
				throw new Error("Invalid response structure");
			}

			// Ensure multiplier is within bounds
			parsed.weightMultiplier = Math.max(0.0, Math.min(2.0, parsed.weightMultiplier));

			return parsed as ProductivityAnalysis;
		} catch (error: any) {
			console.error("❌ Failed to parse AI response:", error.message);
			console.error("Response was:", response);
			throw error;
		}
	}

	/**
	 * Fallback analysis when AI is unavailable
	 */
	private getFallbackAnalysis(currentScreen: ScreenContext): ProductivityAnalysis {
		const app = currentScreen.activeApp?.toLowerCase() || "";
		const title = currentScreen.windowTitle?.toLowerCase() || "";
		const url = currentScreen.url?.toLowerCase() || "";

		// Rule-based fallback logic
		const productiveApps = [
			"visual studio code",
			"code",
			"cursor",
			"terminal",
			"powershell",
			"slack",
			"notion",
			"docs",
		];
		const distractingApps = ["youtube", "twitter", "facebook", "instagram", "tiktok", "reddit"];
		const neutralApps = ["finder", "explorer", "chrome", "firefox", "safari", "edge"];

		let contextRelation: ProductivityAnalysis["contextRelation"] = "maintenance";
		let productivityLevel: ProductivityAnalysis["productivityLevel"] = "neutral";
		let weightMultiplier = 1.0;
		let insight = "Rule-based analysis (AI unavailable)";

		// Check for productive apps
		if (productiveApps.some((pa) => app.includes(pa))) {
			contextRelation = "focused";
			productivityLevel = "productive";
			weightMultiplier = 1.5;
			insight = "Using productive development tool";
		}
		// Check for distracting apps
		else if (distractingApps.some((da) => app.includes(da) || url.includes(da))) {
			contextRelation = "distracted";
			productivityLevel = "distracting";
			weightMultiplier = 0.5;
			insight = "Entertainment or social media detected";
		}
		// Check for educational content
		else if (title.includes("tutorial") || title.includes("course") || title.includes("learn")) {
			contextRelation = "research";
			productivityLevel = "productive";
			weightMultiplier = 1.3;
			insight = "Educational content consumption";
		}
		// Neutral apps
		else if (neutralApps.some((na) => app.includes(na))) {
			contextRelation = "maintenance";
			productivityLevel = "neutral";
			weightMultiplier = 1.0;
			insight = "General application usage";
		}

		return {
			contextRelation,
			productivityLevel,
			weightMultiplier,
			insight,
		};
	}

	/**
	 * Check if the analyzer is enabled and ready
	 */
	isReady(): boolean {
		return this.isEnabled;
	}

	/**
	 * Get the current model being used
	 */
	getModelInfo(): string {
		if (!this.bedrockClient) {
			return "No model (AI disabled)";
		}
		return this.bedrockClient.getModel();
	}
}
