/**
 * Example usage of the Productivity Intelligence services
 * This file demonstrates how to use the Context Analyzer
 */

import { ContextAnalyzer } from "./contextAnalyzer";
import type { ProductivityAnalysis, ScreenContext } from "./types";

// Example 1: Initialize the Context Analyzer
async function initializeAnalyzer() {
	const analyzer = new ContextAnalyzer({
		apiKey: process.env.BEDROCK_API_KEY ?? "",
		region: "us-west-2",
		model: "anthropic.claude-3-sonnet-20240229-v1:0",
	});

	console.log("Analyzer ready:", analyzer.isReady());
	console.log("Using model:", analyzer.getModelInfo());

	return analyzer;
}

// Example 2: Analyze a focused work session
async function analyzeFocusedWork() {
	const analyzer = await initializeAnalyzer();

	const currentScreen: ScreenContext = {
		activeApp: "Visual Studio Code",
		windowTitle: "focus-ai.ts - VS Code",
		url: null,
		timestamp: Date.now(),
	};

	const recentScreens: ScreenContext[] = [
		{
			activeApp: "Chrome",
			windowTitle: "TypeScript Documentation - Mozilla",
			url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
			timestamp: Date.now() - 300000, // 5 minutes ago
		},
		{
			activeApp: "Terminal",
			windowTitle: "bash - npm run dev",
			url: null,
			timestamp: Date.now() - 180000, // 3 minutes ago
		},
		{
			activeApp: "Visual Studio Code",
			windowTitle: "package.json - VS Code",
			url: null,
			timestamp: Date.now() - 60000, // 1 minute ago
		},
	];

	const analysis: ProductivityAnalysis = await analyzer.analyzeContext(currentScreen, recentScreens);

	console.log("📊 Analysis Result:");
	console.log("  Context Relation:", analysis.contextRelation);
	console.log("  Productivity Level:", analysis.productivityLevel);
	console.log("  Weight Multiplier:", analysis.weightMultiplier);
	console.log("  Insight:", analysis.insight);

	// Expected output: focused, productive, multiplier ~1.5-2.0
}

// Example 3: Analyze a distracted session
async function analyzeDistractedSession() {
	const analyzer = await initializeAnalyzer();

	const currentScreen: ScreenContext = {
		activeApp: "Chrome",
		windowTitle: "Funny Cat Videos - YouTube",
		url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
		timestamp: Date.now(),
	};

	const recentScreens: ScreenContext[] = [
		{
			activeApp: "Visual Studio Code",
			windowTitle: "main.ts - VS Code",
			url: null,
			timestamp: Date.now() - 300000, // 5 minutes ago
		},
		{
			activeApp: "Chrome",
			windowTitle: "Twitter / X",
			url: "https://twitter.com/home",
			timestamp: Date.now() - 120000, // 2 minutes ago
		},
		{
			activeApp: "Chrome",
			windowTitle: "Reddit - Popular",
			url: "https://www.reddit.com/r/popular",
			timestamp: Date.now() - 60000, // 1 minute ago
		},
	];

	const analysis: ProductivityAnalysis = await analyzer.analyzeContext(currentScreen, recentScreens);

	console.log("📊 Analysis Result:");
	console.log("  Context Relation:", analysis.contextRelation);
	console.log("  Productivity Level:", analysis.productivityLevel);
	console.log("  Weight Multiplier:", analysis.weightMultiplier);
	console.log("  Insight:", analysis.insight);

	// Expected output: distracted, distracting, multiplier ~0.2-0.5
}

// Example 4: Analyze a research session
async function analyzeResearchSession() {
	const analyzer = await initializeAnalyzer();

	const currentScreen: ScreenContext = {
		activeApp: "Chrome",
		windowTitle: "AWS Bedrock Documentation - Amazon Web Services",
		url: "https://docs.aws.amazon.com/bedrock/",
		timestamp: Date.now(),
	};

	const recentScreens: ScreenContext[] = [
		{
			activeApp: "Visual Studio Code",
			windowTitle: "bedrockClient.ts - VS Code",
			url: null,
			timestamp: Date.now() - 240000, // 4 minutes ago
		},
		{
			activeApp: "Chrome",
			windowTitle: "AWS SDK for JavaScript - npm",
			url: "https://www.npmjs.com/package/@aws-sdk/client-bedrock-runtime",
			timestamp: Date.now() - 120000, // 2 minutes ago
		},
		{
			activeApp: "Chrome",
			windowTitle: "Stack Overflow - How to authenticate with AWS Bedrock",
			url: "https://stackoverflow.com/questions/...",
			timestamp: Date.now() - 60000, // 1 minute ago
		},
	];

	const analysis: ProductivityAnalysis = await analyzer.analyzeContext(currentScreen, recentScreens);

	console.log("📊 Analysis Result:");
	console.log("  Context Relation:", analysis.contextRelation);
	console.log("  Productivity Level:", analysis.productivityLevel);
	console.log("  Weight Multiplier:", analysis.weightMultiplier);
	console.log("  Insight:", analysis.insight);

	// Expected output: research, productive, multiplier ~1.2-1.5
}

// Example 5: Error handling
async function demonstrateErrorHandling() {
	// Invalid API key - should fall back to rule-based analysis
	const analyzer = new ContextAnalyzer({
		apiKey: "invalid_key",
		region: "us-west-2",
	});

	const currentScreen: ScreenContext = {
		activeApp: "Visual Studio Code",
		windowTitle: "main.ts",
		url: null,
		timestamp: Date.now(),
	};

	try {
		const analysis = await analyzer.analyzeContext(currentScreen, []);
		console.log("Fallback analysis:", analysis);
		// Should still return a valid analysis using rule-based fallback
	} catch (error) {
		console.error("Analysis failed:", error);
	}
}

// Run examples
if (require.main === module) {
	console.log("=== Example 1: Focused Work ===");
	analyzeFocusedWork().catch(console.error);

	setTimeout(() => {
		console.log("\n=== Example 2: Distracted Session ===");
		analyzeDistractedSession().catch(console.error);
	}, 3000);

	setTimeout(() => {
		console.log("\n=== Example 3: Research Session ===");
		analyzeResearchSession().catch(console.error);
	}, 6000);

	setTimeout(() => {
		console.log("\n=== Example 4: Error Handling ===");
		demonstrateErrorHandling().catch(console.error);
	}, 9000);
}

export { analyzeDistractedSession, analyzeFocusedWork, analyzeResearchSession, initializeAnalyzer };
