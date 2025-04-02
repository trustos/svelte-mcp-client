import { createOllama, type OllamaProvider as OllamaProv } from 'ollama-ai-provider';
import type { CoreMessage, LanguageModel } from 'ai';
import type { ToolsManager } from '$types';
import { BaseLLMProvider } from './base-provider';

// Define Ollama-specific settings if needed
interface OllamaSettings {
	simulateStreaming?: boolean;
	// Add other Ollama-specific options here if necessary
}

export class OllamaProvider extends BaseLLMProvider {
	private ollama: OllamaProv;
	private ollamaSettings?: OllamaSettings; // Store settings if needed

	constructor(
		toolsManager: ToolsManager,
		model: string = 'qwen2:7b', // Updated default model based on common usage
		private baseUrl: string = 'http://localhost:11434/api' // Default Ollama endpoint
	) {
		super(toolsManager, model); // Call base constructor
		this.ollama = createOllama({
			baseURL: this.baseUrl
		});

		// Define specific settings, e.g., for streaming
		this.ollamaSettings = {
			simulateStreaming: true // Keep this if needed for Ollama streaming behavior
		};

		// Override base temperatures if needed for Ollama
		// this.defaultTemperature = 0.6;
		// this.streamingTemperature = 0.8;
	}

	protected getModelInstance(isStreaming: boolean = false): LanguageModel {
		// Pass settings only when streaming, if they are defined
		return this.ollama(
			this.modelName,
			isStreaming && this.ollamaSettings ? this.ollamaSettings : undefined
		);
	}

	protected processIntermediateStreamMessages(messages: CoreMessage[]): CoreMessage[] {
		// Convert tool messages to assistant messages for the second step
		return messages.map((msg) => {
			if (msg.role === 'tool') {
				// Ensure content is stringified for the assistant message
				const contentString =
					typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
				return {
					role: 'assistant' as const, // Convert role
					content: `Tool response:\n${contentString}` // Prepend context
				};
			}
			return msg;
		});
	}
}
