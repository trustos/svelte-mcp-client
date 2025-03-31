import type { RequestHandler } from './$types';
import { AIToolsManager } from '$lib/tools/tools-manager';
import type { Message, AIConfig } from '$types';
import { AIProviderFactory } from '$lib/llm';
import { loadConfig } from '$lib/config/loader';
import { ToolFactory } from '$lib/tools/tool-factory';
import { createDataStreamResponse } from 'ai';

export const POST: RequestHandler = async ({ request }) => {
	const { messages, config }: { messages: Message[]; config: AIConfig } = await request.json();

	return createDataStreamResponse({
		execute: async (dataStream) => {
			try {
				const mcpConfig = loadConfig();
				const tools = ToolFactory.createTools(mcpConfig);
				const toolsManager = new AIToolsManager(tools);
				const provider = AIProviderFactory.createProvider(config, toolsManager);

				// Call generateStreamResponse which will handle the streaming
				await provider.generateStreamResponse(messages, dataStream);
			} catch (error) {
				console.error('Error in chat endpoint:', error);
				throw error;
			}
		}
	});
};
