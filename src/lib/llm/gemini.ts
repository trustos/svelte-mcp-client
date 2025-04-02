import { createGoogleGenerativeAI, type GoogleGenerativeAIProvider } from '@ai-sdk/google';
import type { CoreMessage, LanguageModel } from 'ai';
import type { ToolsManager } from '$types';
import { BaseLLMProvider } from './base-provider';

export class GeminiProvider extends BaseLLMProvider {
	private google: GoogleGenerativeAIProvider;

	constructor(
		apiKey: string,
		toolsManager: ToolsManager,
		model: string = 'gemini-1.5-flash-latest' // Updated default model
	) {
		super(toolsManager, model); // Call base constructor
		this.google = createGoogleGenerativeAI({
			apiKey
		});
		// Optionally override temperatures if Gemini behaves better with different defaults
		// this.defaultTemperature = 0.5;
		// this.streamingTemperature = 0.7;
	}

	protected getModelInstance(_?: boolean): LanguageModel {
		// Gemini doesn't typically need different settings for streaming via ai-sdk
		return this.google(this.modelName);
	}

	protected processIntermediateStreamMessages(messages: CoreMessage[]): CoreMessage[] {
		// Filter out tool messages for the second step, keeping user/assistant/system
		return messages.filter((msg) => ['user', 'assistant', 'system'].includes(msg.role));
	}
}
