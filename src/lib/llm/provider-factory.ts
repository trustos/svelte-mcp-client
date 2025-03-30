import { GEMINI_API_KEY } from '$env/static/private';

import type { AIConfig, LLMProvider, ToolsManager } from '$types';
import { GeminiProvider } from './gemini';

export class AIProviderFactory {
	static createProvider(config: AIConfig, toolsManager: ToolsManager): LLMProvider {
		switch (config.provider) {
			case 'google':
				return new GeminiProvider(GEMINI_API_KEY, toolsManager, config.model);
			default:
				throw new Error(`Unsupported provider: ${config.provider}`);
		}
	}
}
