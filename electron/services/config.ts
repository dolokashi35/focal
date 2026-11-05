/**
 * Configuration utility for AWS Bedrock
 */

import type { BedrockConfig } from "./types";

/**
 * Load Bedrock configuration from environment or defaults
 */
export function loadBedrockConfig(): BedrockConfig | null {
	// Check for API key in environment
	const apiKey = process.env.BEDROCK_API_KEY;

	if (!apiKey) {
		console.warn("⚠️ BEDROCK_API_KEY not found in environment");
		return null;
	}

	const region = process.env.BEDROCK_REGION || "us-west-2";
	const model = process.env.BEDROCK_MODEL || "anthropic.claude-3-sonnet-20240229-v1:0";

	return {
		apiKey,
		region,
		model,
	};
}

/**
 * Available Bedrock models for context analysis
 */
export const AVAILABLE_MODELS = {
	CLAUDE_3_SONNET: "anthropic.claude-3-sonnet-20240229-v1:0",
	CLAUDE_3_HAIKU: "anthropic.claude-3-haiku-20240307-v1:0",
	CLAUDE_3_OPUS: "anthropic.claude-3-opus-20240229-v1:0",
} as const;

/**
 * Recommended model configurations for different use cases
 */
export const MODEL_RECOMMENDATIONS = {
	FAST: AVAILABLE_MODELS.CLAUDE_3_HAIKU, // Fastest, good for frequent updates
	BALANCED: AVAILABLE_MODELS.CLAUDE_3_SONNET, // Balanced performance and quality
	ACCURATE: AVAILABLE_MODELS.CLAUDE_3_OPUS, // Best quality, slower
} as const;
