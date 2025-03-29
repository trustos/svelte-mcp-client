import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import type { LLMProvider, Message, LLMResponse, ToolsManager } from '$types';

export class GeminiProvider implements LLMProvider {
	private google;

	constructor(
		apiKey: string,
		private toolsManager: ToolsManager,
		private model: string = 'gemini-2.0-flash-001'
	) {
		this.google = createGoogleGenerativeAI({
			apiKey
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
				model: this.google(this.model),
				messages: validMessages,
				system:
					'You are a helpful assistant that can use various tools to help users. Specifically you can save airbnb search results to files within the allowed directories.',
				tools,
				temperature: 0.2 // Add some temperature for more natural responses
			});

			const content = this.toolsManager.parseToolResults(result);

			return {
				role: 'assistant',
				content: content || 'I apologize, but I was unable to generate a response.'
			};
		} catch (error) {
			console.error('Error in GeminiProvider:', error);
			throw error;
		} finally {
			await this.toolsManager.cleanupTools();
		}
	}
}
