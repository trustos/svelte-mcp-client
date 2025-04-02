import { GEMINI_API_KEY } from '$env/static/private';
import type { AIConfig, LLMProvider, ToolsManager } from '$types';
import { GeminiProvider } from './gemini'; // Correct path
import { OllamaProvider } from './ollama'; // Correct path

export class AIProviderFactory {
	static createProvider(config: AIConfig, toolsManager: ToolsManager): LLMProvider {
		let modelName: string | undefined;

		switch (config.provider) {
			case 'google':
				// Ensure API key exists for Gemini
				if (!GEMINI_API_KEY) {
					throw new Error('GEMINI_API_KEY environment variable is not set.');
				}
				return new GeminiProvider(GEMINI_API_KEY, toolsManager, config.model);
			case 'ollama':
				// Extract the model string from the object if needed

				if (typeof config.model === 'object' && config.model !== null) {
					// If model is an object with a value property, extract the value
					modelName = config.model.value;
				} else {
					// Otherwise use it directly (it's already a string or undefined)
					modelName = config.model as string | undefined;
				}

				// Pass baseUrl if provided in config, otherwise use default
				return new OllamaProvider(toolsManager, modelName, config.baseUrl);
			default:
				// Provide a more informative error message
				throw new Error(`Unsupported LLM provider specified in configuration: ${config.provider}`);
		}
	}
}
