import {
	generateText,
	streamText,
	type CoreMessage,
	type CoreToolMessage,
	type DataStreamWriter,
	type LanguageModel,
	type ToolResultPart
} from 'ai';
import {
	type LLMProvider,
	type Message,
	type LLMResponse,
	type ToolsManager,
	SYSTEM_PROMPT
} from '$types';

export abstract class BaseLLMProvider implements LLMProvider {
	// Temperatures can be overridden by subclasses if needed
	protected defaultTemperature = 0.5;
	protected streamingTemperature = 0.7;

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
	protected prepareMessages(messages: Message[]): CoreMessage[] {
		const validMessages = messages
			.filter(
				(msg) =>
					msg.content != null &&
					String(msg.content).trim() !== '' &&
					['user', 'assistant', 'system', 'tool'].includes(msg.role)
			)
			.map((msg): CoreMessage => {
				// Handle tool messages
				if (msg.role === 'tool') {
					const toolResult: ToolResultPart = {
						type: 'tool-result',
						toolCallId: msg.tool_call_id || '',
						toolName: msg.name || '',
						result: msg.content,
						isError: false // default to false unless explicitly set
					};

					return {
						role: 'tool',
						content: [toolResult]
					} as CoreToolMessage;
				}

				// Handle regular messages
				return {
					role: msg.role as 'user' | 'assistant' | 'system',
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

		return validMessages;
	}

	async generateResponse(messages: Message[]): Promise<LLMResponse> {
		try {
			const tools = await this.toolsManager.setupTools();
			const preparedMessages = this.prepareMessages(messages);

			const result = await generateText({
				model: this.getModelInstance(false), // Not streaming
				messages: preparedMessages,
				// System prompt is now added in prepareMessages if needed,
				// but we still pass the main one to generateText for context.
				system: SYSTEM_PROMPT,
				maxSteps: 5,
				experimental_continueSteps: true, // Keep for potential multi-step non-streaming tool use
				tools,
				temperature: this.defaultTemperature
			});

			const content = this.toolsManager.parseToolResults(result);

			return {
				role: 'assistant',
				content: content || 'I apologize, but I was unable to generate a response.'
			};
		} catch (error) {
			console.error(`Error in ${this.constructor.name}:`, error);
			throw error; // Re-throw the error after logging
		} finally {
			await this.toolsManager.cleanupTools();
		}
	}

	async generateStreamResponse(messages: Message[], dataStream: DataStreamWriter): Promise<void> {
		let tools;
		try {
			tools = await this.toolsManager.setupTools();
			const preparedMessages = this.prepareMessages(messages);

			// Step 1: Initial analysis / Tool determination
			const result1 = streamText({
				model: this.getModelInstance(true), // Streaming
				messages: preparedMessages,
				// System prompt for analysis step (could be different if needed)
				system:
					'Analyze the user request and determine required tools. Respond concisely if no tools are needed.',
				maxSteps: 2, // Limit steps for analysis phase
				experimental_continueSteps: true,
				tools,
				temperature: this.defaultTemperature // Lower temperature for analysis
			});

			// Merge stream 1 without sending finish
			result1.mergeIntoDataStream(dataStream, {
				experimental_sendFinish: false
			});

			// Await the *full* response from step 1 to get intermediate messages
			const step1Result = await result1.response;

			// Process intermediate messages (provider-specific logic)
			const intermediateMessages = this.processIntermediateStreamMessages(step1Result.messages);

			// Step 2: Generate final response with tool results (if any)
			const result2 = streamText({
				model: this.getModelInstance(true), // Streaming
				// Combine original prepared messages with processed intermediate ones
				messages: [...preparedMessages, ...intermediateMessages],
				system: SYSTEM_PROMPT, // Main system prompt for generation
				tools,
				maxSteps: 5, // Allow more steps for generation
				temperature: this.streamingTemperature // Higher temperature for generation
			});

			// Merge stream 2 without sending start
			result2.mergeIntoDataStream(dataStream, {
				experimental_sendStart: false
			});
		} catch (error) {
			console.error(`Error in streaming ${this.constructor.name}:`, error);
			// Try to send an error message through the stream if possible
			try {
				const errorJson = JSON.stringify({
					type: 'error',
					error: { message: error instanceof Error ? error.message : String(error) }
				});
				dataStream.writeData(errorJson);
			} catch (streamError) {
				console.error('Failed to send error via dataStream:', streamError);
			}
			// Ensure stream is closed even on error
			throw error; // Re-throw the original error
		} finally {
			if (tools) {
				// Only cleanup if setupTools succeeded
				await this.toolsManager.cleanupTools();
			}
			// Ensure the stream is closed in the finally block if it hasn't been already
			// (mergeIntoDataStream should handle closing on success)
			// dataStream.close(); // Careful: mergeIntoDataStream might already close it. Test this.
			// Let's rely on mergeIntoDataStream to close on success.
		}
	}
}
