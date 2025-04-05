import { Experimental_StdioMCPTransport as stdioTransport } from 'ai/mcp-stdio';
import { experimental_createMCPClient } from 'ai';
import type { MCPServerConfig } from '$types';
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
			// Filter out undefined values from the env object
			// Use a type predicate function signature for the filter
			const transportEnv = this.config.env
				? Object.fromEntries(
						Object.entries(this.config.env).filter(
							(entry): entry is [string, string] => typeof entry[1] === 'string'
						)
					)
				: undefined;

			console.log(`[MCPTool] Setting up env vars: ${JSON.stringify(transportEnv)}...`);

			console.log(`[MCPTool] Setting up ${this.serverId}...`);
			const stdio = new stdioTransport({
				command: this.config.command,
				args: this.config.args,
				env: transportEnv
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
		// 1. Handle non-object inputs defensively
		if (typeof resultData !== 'object' || resultData === null) {
			console.warn(
				`[MCPTool ${this.serverId}] Received non-object result for parsing:`,
				resultData
			);
			try {
				// Attempt to stringify even non-objects
				return JSON.stringify(resultData) ?? '[Received unparseable non-object result]';
			} catch (e) {
				console.error(`[MCPTool ${this.serverId}] Error stringifying non-object result:`, e);
				return '[Received unparseable non-object result]';
			}
		}

		// 2. Cast to Record for easier property access
		const result = resultData as Record<string, unknown>;

		// 3. Handle Explicit Errors first
		// Check if the result object itself indicates an error status
		if (result.isError === true || result.status === 'error') {
			const errorMessage = typeof result.message === 'string' ? result.message : 'Unknown error';
			console.error(
				`[MCPTool ${this.serverId}] Tool execution failed:`,
				errorMessage,
				'Full result:',
				result
			);
			// Return a clear error message string to the LLM
			return `Tool '${this.constructor.name}' execution failed: ${errorMessage}`;
		}

		// 4. For ALL other cases (success, or unknown status/structure), stringify the *entire* result object.
		// This ensures the full JSON from airbnb_search (or any tool) is preserved as a string.
		try {
			// Use indentation for readability in logs and potentially easier parsing by LLM
			const jsonString = JSON.stringify(result, null, 2);
			console.log(
				`[MCPTool ${this.serverId}] Stringifying entire successful/non-error tool result.`
			);
			// console.log("Stringified Result:", jsonString); // Optional: Log the actual string being returned
			return jsonString;
		} catch (stringifyError) {
			console.error(
				`[MCPTool ${this.serverId}] Failed to stringify tool result:`,
				stringifyError,
				'Original result:',
				result
			);
			// Fallback if stringify fails
			return `[Failed to stringify tool result: ${stringifyError instanceof Error ? stringifyError.message : 'Unknown error'}]`;
		}
	}

	hasCapability(capability: string): boolean {
		return this.capabilities.includes(capability);
	}
}
