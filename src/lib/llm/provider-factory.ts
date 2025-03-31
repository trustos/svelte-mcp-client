import { GEMINI_API_KEY } from '$env/static/private';

import type { AIConfig, LLMProvider, ToolsManager } from '$types';
import { GeminiProvider } from './gemini';
import { OllamaProvider } from './ollama';

export class AIProviderFactory {
	static createProvider(config: AIConfig, toolsManager: ToolsManager): LLMProvider {
		switch (config.provider) {
			case 'google':
				return new GeminiProvider(GEMINI_API_KEY, toolsManager, config.model);
			case 'ollama':
				return new OllamaProvider(toolsManager, config.model);
			default:
				throw new Error(`Unsupported provider: ${config.provider}`);
		}
	}
}
