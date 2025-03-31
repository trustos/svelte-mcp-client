import { createOllama } from 'ollama-ai-provider';
import { generateText } from 'ai';
import {
	type LLMProvider,
	type Message,
	type LLMResponse,
	type ToolsManager,
	SYSTEM_PROMPT
} from '$types';

export class OllamaProvider implements LLMProvider {
	private ollama;

	constructor(
		private toolsManager: ToolsManager,
		private model: string = 'qwen2.5:7b', // default model
		private baseUrl: string = 'http://localhost:11434/api' // default Ollama endpoint
	) {
		this.ollama = createOllama({
			baseURL: this.baseUrl
		});
	}

	async generateResponse(messages: Message[]): Promise<LLMResponse> {
		try {
			const tools = await this.toolsManager.setupTools();

			// Filter out any empty messages and ensure proper formatting
			const validMessages = messages.filter((msg) => msg.content?.trim());

			// Add a system message if none exists
			if (!validMessages.some((msg) => msg.role === 'system')) {
				validMessages.unshift({
					role: 'system',
					content: 'You are a helpful assistant that can use various tools to help users.'
				});
			}

			const result = await generateText({
				model: this.ollama(this.model),
				messages: validMessages,
				system: SYSTEM_PROMPT,
				tools,
				maxSteps: 5,
				temperature: 0.7 // Ollama often works well with a slightly higher temperature
			});

			const content = this.toolsManager.parseToolResults(result);

			return {
				role: 'assistant',
				content: content || 'I apologize, but I was unable to generate a response.'
			};
		} catch (error) {
			console.error('Error in OllamaProvider:', error);
			throw error;
		} finally {
			await this.toolsManager.cleanupTools();
		}
	}
}
