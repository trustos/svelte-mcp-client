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
		const stdio = new stdioTransport({
			command: this.config.command,
			args: this.config.args
		});

		this.client = await experimental_createMCPClient({
			transport: stdio
		});

		return await this.client.tools();
	}

	async cleanup(): Promise<void> {
		if (this.client) {
			await this.client.close();
		}
	}

	parseToolResult(result: ToolResult): string {
		if (!result.result || !('content' in result.result)) {
			return JSON.stringify(result.result);
		}

		const resultContent = result.result.content;
		if (!Array.isArray(resultContent)) {
			return '';
		}

		return resultContent
			.map((item: ContentItem) => {
				if (item.type === 'text') {
					return item.text;
				} else if (item.type === 'resource' && item.resource.text) {
					return item.resource.text;
				}
				return '';
			})
			.join('');
	}
}
