import { Experimental_StdioMCPTransport as stdioTransport } from 'ai/mcp-stdio';
import { experimental_createMCPClient } from 'ai';
import type { ContentItem, MCPServerConfig } from '$types';
import type { ToolSet } from 'ai';
import { BaseMCPTool } from './base.tool';

export class MCPTool extends BaseMCPTool {
	private client: Awaited<ReturnType<typeof experimental_createMCPClient>> | null = null;
	public readonly capabilities: ReadonlyArray<string>;
	public readonly serverId: string; // Make sure this is public readonly

	constructor(
		config: MCPServerConfig, // Renamed for clarity within constructor scope
		serverId: string // serverId passed in
	) {
		super(config); // Pass the config object to the base class
		this.serverId = serverId; // Store the serverId
		// Ensure capabilities is always an array, defaulting to empty if not provided
		this.capabilities = Object.freeze([...(config.capabilities ?? [])]);
		console.log(
			`[MCPTool] Initialized ${this.serverId} with capabilities: ${this.capabilities.join(', ')}`
		);
	}

	async setup(): Promise<ToolSet> {
		try {
			console.log(`[MCPTool] Setting up ${this.serverId}...`);
			const stdio = new stdioTransport({
				command: this.config.command,
				args: this.config.args
			});

			this.client = await experimental_createMCPClient({
				transport: stdio
			});

			const tools = await this.client.tools();
			console.log(`[MCPTool] ${this.serverId} setup complete. Tools found:`, Object.keys(tools));
			return tools;
		} catch (error) {
			console.error(`[MCPTool] Error during setup for ${this.serverId}:`, error);
			throw new Error(
				`Failed to set up MCP client ${this.serverId}: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	async cleanup(): Promise<void> {
		console.log(`[MCPTool] Cleaning up ${this.serverId}...`);
		if (this.client) {
			try {
				await this.client.close();
				console.log(`[MCPTool] ${this.serverId} closed successfully.`);
				this.client = null; // Ensure client is nullified after close
			} catch (error) {
				console.error(`[MCPTool] Error during close for ${this.serverId}:`, error);
				// Optionally re-throw or handle cleanup failure
			}
		} else {
			console.log(`[MCPTool] ${this.serverId} already cleaned up or never setup.`);
		}
	}

	//Within the tool call method in your external program/script do:
	// if (successful) {
	//   return JSON.stringify({"status": "success", "content": ....})
	// } else {
	//   return JSON.stringify({"status": "error", "message": "Detailed error message here"})
	// }

	parseToolResult(resultData: unknown): string {
		// Defensive check: Ensure resultData is an object before proceeding
		if (typeof resultData !== 'object' || resultData === null) {
			console.warn(
				`[MCPTool ${this.serverId}] Received non-object result for parsing:`,
				resultData
			);
			return JSON.stringify(resultData) ?? '';
		}

		const result = resultData as Record<string, unknown>; // Cast for easier access

		if (typeof result === 'object' && result !== null && 'status' in result) {
			if (result.status === 'error') {
				console.error(
					`[MCPTool ${this.serverId}] Tool execution failed:`,
					result.message || 'Unknown error'
				);
				return `Tool execution failed: ${result.message || 'Unknown error'}`;
			}
			// Handle success status if needed, e.g., extracting a specific message
			if (result.status === 'success' && result.message && typeof result.message === 'string') {
				return result.message;
			}
		}

		// Check for the 'content' array structure specifically
		if ('content' in result && Array.isArray(result.content)) {
			const contentItems = result.content as ContentItem[]; // Type assertion
			return contentItems
				.map((item: ContentItem) => {
					if (item.type === 'text') {
						return item.text;
					} else if (item.type === 'resource' && item.resource?.text) {
						// Check resource exists
						return item.resource.text;
					} else if (item.type === 'image') {
						return `[Image data: ${item.mimeType ?? 'unknown type'}]`; // Handle missing mimeType
					}
					// Consider logging unsupported types more explicitly
					console.warn(`[MCPTool ${this.serverId}] Unsupported content item type: ${item.type}`);
					return `[Unsupported content type: ${item.type}]`;
				})
				.filter(Boolean) // Filter out potential null/undefined from mapping
				.join('\n'); // Join with newline for readability
		}

		// Fallback: Stringify the whole result object if 'content' array isn't found or structure is different
		console.log(
			`[MCPTool ${this.serverId}] Result structure not recognized for direct content extraction, stringifying:`,
			result
		);
		return JSON.stringify(result, null, 2);
	}

	hasCapability(capability: string): boolean {
		return this.capabilities.includes(capability);
	}
}
