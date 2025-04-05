import {
	generateText,
	streamText,
	type CoreMessage,
	type DataStreamWriter,
	type LanguageModel,
	type ToolResultPart,
	type ToolSet
} from 'ai';
import {
	type LLMProvider,
	type Message,
	type LLMResponse,
	type ToolsManager,
	type RequestContext,
	SYSTEM_PROMPT
} from '$types';

export abstract class BaseLLMProvider implements LLMProvider {
	// Temperatures can be overridden by subclasses if needed
	protected defaultTemperature = 0.3;
	protected streamingTemperature = 0.3;

	constructor(
		protected toolsManager: ToolsManager,
		protected modelName: string
	) {}

	/**
	 * Abstract method to get the specific language model instance.
	 * @param isStreaming Indicates if the model instance is needed for streaming (Ollama might have different settings).
	 */
	protected abstract getModelInstance(isStreaming?: boolean): LanguageModel;

	/**
	 * Abstract method to process intermediate messages during streaming.
	 * Different providers might handle tool messages differently between steps.
	 * @param messages Messages from the first streaming step.
	 * @returns Processed messages for the second streaming step.
	 */
	protected abstract processIntermediateStreamMessages(messages: CoreMessage[]): CoreMessage[];

	/**
	 * Prepares messages for the AI SDK:
	 * - Filters out empty messages.
	 * - Ensures roles are compatible ('user', 'assistant', 'system', 'tool').
	 * - Stringifies non-string content.
	 * - Adds a system prompt if none exists.
	 */
	protected prepareMessages(messages: Message[], context?: RequestContext): CoreMessage[] {
		console.log(`[LLM] Preparing ${messages.length} messages`);

		const validMessages = messages
			.filter((msg) => {
				const isValid =
					msg.content != null &&
					String(msg.content).trim() !== '' &&
					['user', 'assistant', 'system', 'tool'].includes(msg.role);
				if (!isValid) {
					console.log(`[LLM] Filtered out invalid message:`, msg);
				}
				return isValid;
			})
			.map((msg): CoreMessage => {
				console.log(`[LLM] Processing message of role: ${msg.role}`);

				if (msg.role === 'tool') {
					console.log(`[LLM] Processing tool message with id: ${msg.tool_call_id}`);
					const toolResult: ToolResultPart = {
						type: 'tool-result',
						toolCallId: msg.tool_call_id || '',
						toolName: msg.name || '',
						result: msg.content,
						isError: false
					};
					return {
						role: 'tool',
						content: [toolResult]
					};
				}

				return {
					role: msg.role as 'user' | 'assistant' | 'system',
					content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
				};
			});

		if (!validMessages.some((msg) => msg.role === 'system')) {
			console.log('[LLM] Adding default system prompt with context');
			let contextPrefix = '';
			if (context?.dateTime) {
				contextPrefix += `Current date and time: ${context.dateTime}\n`;
			}
			if (context?.location) {
				contextPrefix += `Current location: Latitude ${context.location.latitude}, Longitude ${context.location.longitude}\n`;
			}
			const systemContent = contextPrefix ? `${contextPrefix}\n${SYSTEM_PROMPT}` : SYSTEM_PROMPT;


			console.log(context);
			console.log(systemContent);

			validMessages.unshift({
				role: 'system',
				content: systemContent
			});
		}

		console.log(`[LLM] Prepared ${validMessages.length} valid messages`);
		return validMessages;
	}

	async generateResponse(messages: Message[], context?: RequestContext): Promise<LLMResponse> {
		console.log(`[LLM] Generating response for ${messages.length} messages`);
		try {
			const tools = await this.toolsManager.setupTools();
			console.log(`[LLM] Tools setup completed, available tools:`, Object.keys(tools));

			const preparedMessages = this.prepareMessages(messages, context);
			console.log('[LLM] Generating text with model:', this.modelName);

			const result = await generateText({
				model: this.getModelInstance(false),
				messages: preparedMessages,
				maxSteps: 15,
				experimental_continueSteps: true,
				tools,
				temperature: this.defaultTemperature
			});

			console.log('[LLM] Raw result received from model');
			const content = this.toolsManager.parseToolResults(result);
			console.log('[LLM] Parsed tool results:', content);

			return {
				role: 'assistant',
				content: content || 'I apologize, but I was unable to generate a response.'
			};
		} catch (error) {
			console.error(`[LLM] Error in ${this.constructor.name}:`, error);
			throw error;
		} finally {
			console.log('[LLM] Cleaning up tools');
			await this.toolsManager.cleanupTools();
		}
	}

	async generateStreamResponse(
		messages: Message[],
		dataStream: DataStreamWriter,
		context?: RequestContext
	): Promise<void> {
		let tools: ToolSet;
		try {
			tools = await this.toolsManager.setupTools();
			const preparedMessages = this.prepareMessages(messages, context);

			const stream = streamText({
				model: this.getModelInstance(true),
				messages: preparedMessages,
				maxSteps: 15,
				tools,
				temperature: this.streamingTemperature,
				// Add onFinish callback to clean up only when complete
				onFinish: async () => {
					// Only now is it safe to clean up tools
					if (tools) {
						console.log('[LLM] Stream: Cleaning up tools after completion');
						await this.toolsManager.cleanupTools();
					}
				}
			});

			// Ensure stream is consumed even if client disconnects
			stream.consumeStream();

			stream.mergeIntoDataStream(dataStream);

			// REMOVE THIS LINE - Don't call cleanup here
		} catch (error) {
			console.error(`Error in streaming ${this.constructor.name}:`, error);
			try {
				const errorJson = JSON.stringify({
					type: 'error',
					error: { message: error instanceof Error ? error.message : String(error) }
				});
				dataStream.writeData(errorJson);
			} catch (streamError) {
				console.error('Failed to send error via dataStream:', streamError);
			}

			// Don't clean up tools here either - might cause nested errors
			throw error;
		}
	}
}
