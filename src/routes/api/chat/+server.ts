import { GEMINI_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';
import { AIToolsManager } from '$lib/tools/tools-manager';
import { FilesystemTool } from '$lib/tools/filesystem.tool';
import type { Message, AIConfig } from '$types';
import { AIProviderFactory } from '$lib/llm';

export const POST: RequestHandler = async ({ request }) => {
	const { messages, config }: { messages: Message[]; config: AIConfig } = await request.json();

	const filesystemTool = new FilesystemTool();
	const toolsManager = new AIToolsManager([filesystemTool]);

	try {
		const provider = AIProviderFactory.createProvider(config, GEMINI_API_KEY, toolsManager);
		const response = await provider.generateResponse(messages);
		return new Response(JSON.stringify(response), { status: 200 });
	} catch (error) {
		console.error(error);
		return new Response(
			JSON.stringify({
				role: 'assistant',
				content: 'Sorry, I encountered an error. Please try again.'
			}),
			{ status: 500 }
		);
	}
};
