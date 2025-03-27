import type { AIConfig, LLMProvider, ToolsManager } from '$types';
import { GeminiProvider } from './gemini';

export class AIProviderFactory {
	static createProvider(config: AIConfig, apiKey: string, toolsManager: ToolsManager): LLMProvider {
		switch (config.provider) {
			case 'google':
				return new GeminiProvider(apiKey, toolsManager, config.model);
			default:
				throw new Error(`Unsupported provider: ${config.provider}`);
		}
	}
}
