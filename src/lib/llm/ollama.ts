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

	async generateStreamResponse(messages: Message[], dataStream: DataStreamWriter): Promise<void> {
		console.log('Starting generateStreamResponse with hybrid approach');
		console.log('Model being used:', this.model);

		try {
			// First, detect if the query likely needs tools
			const lastUserMessage = messages.filter((m) => m.role === 'user').pop()?.content || '';
			console.log('Last user message:', lastUserMessage);

			// Check if the message contains keywords that suggest tool use
			const toolKeywords = [
				'file',
				'directory',
				'save',
				'search files',
				'read',
				'write',
				'create',
				'list',
				'move',
				'airbnb',
				'listing'
			];

			const likelyNeedsTools = toolKeywords.some((keyword) =>
				lastUserMessage.toLowerCase().includes(keyword.toLowerCase())
			);

			console.log('Detected tool usage needs:', likelyNeedsTools);

			if (likelyNeedsTools) {
				// APPROACH FOR TOOL-BASED QUERIES: Use non-streaming first, then stream the result
				console.log('Using tool-based approach with non-streaming generation first');

				// Set up tools
				console.log('Setting up tools...');
				const tools = await this.toolsManager.setupTools();
				console.log('Tools loaded:', Object.keys(tools).length, 'available tools');

				const validMessages = messages.filter((msg) => msg.content?.trim());

				// Add system message if needed
				if (!validMessages.some((msg) => msg.role === 'system')) {
					validMessages.unshift({
						role: 'system',
						content: 'You are a helpful assistant that can use various tools to help users.'
					});
				}

				try {
					console.log('Generating non-streaming response with tools...');
					const result = await generateText({
						model: this.ollama(this.model),
						messages: validMessages,
						system: SYSTEM_PROMPT,
						tools,
						maxSteps: 5,
						temperature: 0.7
					});

					console.log(
						'Non-streaming generation complete. Result:',
						JSON.stringify(result, null, 2)
					);

					// Parse tool results
					const content = this.toolsManager.parseToolResults(result);
					console.log('Parsed tool results:', content);

					// Now stream this content back to the user
					console.log('Creating stream with processed content...');
					const resultStream = streamText({
						model: this.ollama(this.model),
						messages: [
							{
								role: 'user',
								content:
									'Please format and return the following content verbatim, maintaining all formatting: ' +
									content
							}
						],
						temperature: 0
					});

					resultStream.mergeIntoDataStream(dataStream);
				} catch (toolError) {
					console.error('Error with tool-based generation:', toolError);

					// Fall back to text generation without tools
					const basicStream = streamText({
						model: this.ollama(this.model),
						messages: validMessages,
						system:
							"I apologize, but I'm having trouble using tools right now. I'll try to help you directly.",
						temperature: 0.7
					});

					basicStream.mergeIntoDataStream(dataStream);
				}
			} else {
				// APPROACH FOR REGULAR QUERIES: Use streaming directly
				console.log('Using direct streaming approach (no tools needed)');

				const validMessages = messages.filter((msg) => msg.content?.trim());

				const stream = streamText({
					model: this.ollama(this.model),
					messages: validMessages,
					system: "You are a helpful assistant. Respond directly to the user's question.",
					temperature: 0.7
				});

				stream.mergeIntoDataStream(dataStream);
			}
		} catch (error) {
			console.error('Error in generateStreamResponse:', error);

			// Create a fallback stream with an error message
			try {
				const errorStream = streamText({
					model: this.ollama(this.model),
					messages: [
						{
							role: 'user',
							content:
								'Please respond with: "I apologize, but I encountered an error while processing your request."'
						}
					],
					temperature: 0
				});

				errorStream.mergeIntoDataStream(dataStream);
			} catch (fallbackError) {
				console.error('Even fallback failed:', fallbackError);
			}
		} finally {
			console.log('Cleaning up tools...');
			await this.toolsManager.cleanupTools();
			console.log('Tools cleanup complete');
		}
	}
}
