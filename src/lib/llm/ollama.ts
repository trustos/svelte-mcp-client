import { createOllama } from 'ollama-ai-provider';
import { generateText, streamText, type DataStreamWriter } from 'ai';
import {
	type LLMProvider,
	type Message,
	type LLMResponse,
	type ToolsManager,
	SYSTEM_PROMPT
} from '$types';

export class OllamaProvider implements LLMProvider {
	private ollama;
	private ollamaSettings;

	constructor(
		private toolsManager: ToolsManager,
		private model: string = 'qwen2.5:7b', // default model
		private baseUrl: string = 'http://localhost:11434/api' // default Ollama endpoint
	) {
		this.ollama = createOllama({
			baseURL: this.baseUrl
		});

		this.ollamaSettings = {
			simulateStreaming: true
		};
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

	async generateStreamResponse(messages: Message[], dataStream: DataStreamWriter): Promise<void> {
		try {
			const tools = await this.toolsManager.setupTools();
			const validMessages = messages.filter((msg) => msg.content?.trim());

			// Step 1: Initial analysis
			const result1 = streamText({
				model: this.ollama(this.model, this.ollamaSettings),
				messages: validMessages,
				system: 'Analyze the user request and determine required tools.',
				maxSteps: 2,
				experimental_continueSteps: true,
				tools,
				temperature: 0.5 // Add some temperature for more natural responses
			});

			result1.mergeIntoDataStream(dataStream, {
				experimental_sendFinish: false
			});

			// Step 2: Generate response with tool results
			const step1Messages = (await result1.response).messages;
			const result2 = streamText({
				model: this.ollama(this.model, this.ollamaSettings),
				messages: [...validMessages, ...step1Messages],
				system: SYSTEM_PROMPT,
				tools,
				maxSteps: 5,
				temperature: 0.7
			});

			result2.mergeIntoDataStream(dataStream, {
				experimental_sendStart: false
			});
		} catch (error) {
			console.error('Error in OllamaProvider:', error);
			throw error;
		} finally {
			await this.toolsManager.cleanupTools();
		}
	}
}
