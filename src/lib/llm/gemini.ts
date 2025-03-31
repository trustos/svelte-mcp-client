import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, streamText, type DataStreamWriter } from 'ai';
import {
	type LLMProvider,
	type Message,
	type LLMResponse,
	type ToolsManager,
	SYSTEM_PROMPT
} from '$types';

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
				system: SYSTEM_PROMPT,
				maxSteps: 5,
				experimental_continueSteps: true,
				tools,
				temperature: 0.5 // Add some temperature for more natural responses
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

	async generateStreamResponse(messages: Message[], dataStream: DataStreamWriter): Promise<void> {
		try {
			const tools = await this.toolsManager.setupTools();

			// Filter and convert messages to supported formats
			const validMessages = messages
				.filter((msg) => {
					// Only include messages with supported roles
					return ['user', 'assistant', 'system'].includes(msg.role) && msg.content?.trim();
				})
				.map((msg) => {
					// Convert message content to proper format
					return {
						role: msg.role,
						content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
					};
				});

			// Add system message if none exists
			if (!validMessages.some((msg) => msg.role === 'system')) {
				validMessages.unshift({
					role: 'system',
					content: SYSTEM_PROMPT
				});
			}

			// Step 1: Initial analysis
			const result1 = streamText({
				model: this.google(this.model),
				messages: validMessages,
				system: 'Analyze the user request and determine required tools.',
				maxSteps: 2,
				experimental_continueSteps: true,
				tools,
				temperature: 0.5
			});

			result1.mergeIntoDataStream(dataStream, {
				experimental_sendFinish: false
			});

			// Step 2: Generate response with tool results
			const step1Messages = (await result1.response).messages.filter((msg) =>
				['user', 'assistant', 'system'].includes(msg.role)
			); // Filter out tool messages

			const result2 = streamText({
				model: this.google(this.model),
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
			console.error('Error in GeminiProvider:', error);
			throw error;
		} finally {
			await this.toolsManager.cleanupTools();
		}
	}
}
