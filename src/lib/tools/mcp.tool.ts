import { Experimental_StdioMCPTransport as stdioTransport } from 'ai/mcp-stdio';
import { experimental_createMCPClient } from 'ai';
import type { ContentItem, ToolResult, MCPServerConfig } from '$types';
import type { ToolSet } from 'ai';
import { BaseMCPTool } from './base.tool';

export class MCPTool extends BaseMCPTool {
	private client: Awaited<ReturnType<typeof experimental_createMCPClient>> | null = null;

	constructor(protected config: MCPServerConfig) {
		super(config);
	}

	async setup(): Promise<ToolSet> {
		try {
			const stdio = new stdioTransport({
				command: this.config.command,
				args: this.config.args
			});

			this.client = await experimental_createMCPClient({
				transport: stdio
			});

			return await this.client.tools();
		} catch (error) {
			console.error('Error during MCP setup:', error);
			throw new Error(
				`Failed to set up MCP client: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	async cleanup(): Promise<void> {
		if (this.client) {
			try {
				await this.client.close();
			} catch (error) {
				console.error('Error during MCP close:', error);
				// Optionally re-throw or handle cleanup failure
			}
		}
	}

	//Within the tool call method in your external program/script do:
	// if (successful) {
	//   return JSON.stringify({"status": "success", "content": ....})
	// } else {
	//   return JSON.stringify({"status": "error", "message": "Detailed error message here"})
	// }

	parseToolResult(result: ToolResult): string {
		if (!result.result) {
			return 'Tool returned no result.';
		}

		const resultContent = result.result;

		if (typeof resultContent === 'object' && resultContent !== null && 'status' in resultContent) {
			if (resultContent.status === 'error') {
				return `Tool execution failed: ${resultContent.message || 'Unknown error'}`;
			}
		}

		if (!('content' in result.result)) {
			return JSON.stringify(result.result, null, 2);
		}

		const resultContentArray = result.result.content;
		if (!Array.isArray(resultContentArray)) {
			return '';
		}

		return resultContentArray
			.map((item: ContentItem) => {
				if (item.type === 'text') {
					return item.text;
				} else if (item.type === 'resource' && item.resource.text) {
					return item.resource.text;
				} else if (item.type === 'image') {
					return `[Image data: ${item.mimeType}]`;
				}
				return `[Unsupported content type: ${item.type}]`;
			})
			.join('');
	}
}
