import type { RequestHandler } from './$types';
import { AIToolsManager } from '$lib/tools/tools-manager';
import type { Message, AIConfig, RequestContext } from '$types';
import { AIProviderFactory } from '$lib/llm';
import { loadConfig } from '$lib/config/loader';
import { ToolFactory } from '$lib/tools/tool-factory';
import { createDataStreamResponse } from 'ai';

export const POST: RequestHandler = async ({ request }) => {
	const {
		messages,
		config,
		context
	}: { messages: Message[]; config: AIConfig; context?: RequestContext } = await request.json();

	return createDataStreamResponse({
		execute: async (dataStream) => {
			const mcpConfig = loadConfig();
			const tools = ToolFactory.createTools(mcpConfig);
			const toolsManager = new AIToolsManager(tools);
			const provider = AIProviderFactory.createProvider(config, toolsManager);

			try {
				// Call generateStreamResponse which will handle the streaming
				await provider.generateStreamResponse(messages, dataStream, context);
			} catch (error) {
				console.error('Error in chat endpoint:', error);
				dataStream.writeData({
					type: 'error',
					error: { message: error instanceof Error ? error.message : String(error) }
				});
			} finally {
				// IMPORTANT: Only clean up after the stream is fully processed
				// DO NOT close MCP clients during the stream
			}
		},
		onError: (error) => {
			console.error('Stream error:', error);
			return error instanceof Error ? error.message : 'An unknown error occurred';
		}
	});
};
