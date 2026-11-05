/**
 * Thin wrapper around the AWS Bedrock runtime for Claude models.
 *
 * Credentials are never hardcoded: they come from the standard AWS credential
 * chain (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY, ~/.aws, SSO, etc.), or from
 * a Bedrock API key passed in config (exposed to the SDK as AWS_BEARER_TOKEN_BEDROCK).
 */

import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import type { BedrockConfig } from "./types";

const DEFAULT_MODEL = "anthropic.claude-3-haiku-20240307-v1:0";
const DEFAULT_REGION = "us-west-2";

export class BedrockClient {
	private client: BedrockRuntimeClient | null = null;
	private readonly model: string;

	constructor(config: BedrockConfig) {
		this.model = config.model || DEFAULT_MODEL;

		if (config.apiKey && !process.env.AWS_BEARER_TOKEN_BEDROCK) {
			process.env.AWS_BEARER_TOKEN_BEDROCK = config.apiKey;
		}

		this.client = new BedrockRuntimeClient({ region: config.region || DEFAULT_REGION });
	}

	isInitialized(): boolean {
		return this.client !== null;
	}

	getModel(): string {
		return this.model;
	}

	/**
	 * Send a single-turn prompt to the model and return the text response.
	 */
	async invokeModel(prompt: string, maxTokens = 512): Promise<string> {
		if (!this.client) {
			throw new Error("Bedrock client not initialized");
		}

		const command = new InvokeModelCommand({
			modelId: this.model,
			contentType: "application/json",
			accept: "application/json",
			body: JSON.stringify({
				anthropic_version: "bedrock-2023-05-31",
				max_tokens: maxTokens,
				temperature: 0.3,
				messages: [{ role: "user", content: prompt }],
			}),
		});

		const response = await this.client.send(command);
		if (!response.body) {
			throw new Error("Empty response from Bedrock");
		}

		const json = JSON.parse(new TextDecoder().decode(response.body));
		const text = json.content?.find((block: { type: string }) => block.type === "text")?.text;
		if (typeof text !== "string") {
			throw new Error("Unexpected Bedrock response shape");
		}
		return text;
	}
}
