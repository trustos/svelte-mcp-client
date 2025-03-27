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

			const result = await generateText({
				model: this.google(this.model),
				messages,
				tools
			});

			const content = this.toolsManager.parseToolResults(result);

			return {
				role: 'assistant',
				content
			};
		} catch (error) {
			console.error(error);
			throw error;
		} finally {
			await this.toolsManager.cleanupTools();
		}
	}
}
