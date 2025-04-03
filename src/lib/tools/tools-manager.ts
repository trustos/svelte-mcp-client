import type { GenerateTextResult, AITool, ToolsManager } from '$types';
// Only import ToolSet from 'ai' - Remove ToolResult
import type { ToolSet } from 'ai';
import { MCPTool } from './mcp.tool';

// Define capabilities that should have priority routing
const PRIORITY_CAPABILITIES = ['filesystem', 'search', 'booking'];

export class AIToolsManager implements ToolsManager {
	private tools: AITool[] = [];
	private finalToolSet: ToolSet = {};
	private finalToolMap: Map<string, AITool> = new Map();
	private designatedServers: Map<string, MCPTool> = new Map();

	constructor(tools: AITool[]) {
		this.tools = tools;
		this.findDesignatedServers();
	}

	private findDesignatedServers(): void {
		this.designatedServers.clear();
		for (const capability of PRIORITY_CAPABILITIES) {
			const designatedTool = this.tools.find(
				(tool) => tool instanceof MCPTool && tool.hasCapability(capability)
			) as MCPTool | undefined;

			if (designatedTool) {
				console.log(
					`[ToolManager] Designated server for capability "${capability}": ${designatedTool.serverId}`
				);
				this.designatedServers.set(capability, designatedTool);
			} else {
				console.warn(
					`[ToolManager] No designated server found for priority capability: "${capability}"`
				);
			}
		}
	}

	private isDesignatedForPriority(instance: AITool): boolean {
		if (!(instance instanceof MCPTool)) return false;
		for (const capability of PRIORITY_CAPABILITIES) {
			if (this.designatedServers.get(capability) === instance) {
				return true;
			}
		}
		return false;
	}

	async setupTools(): Promise<ToolSet> {
		console.log('[ToolManager] Setting up tools...');
		this.finalToolSet = {};
		this.finalToolMap.clear();

		const discoveredTools = new Map<string, { instance: AITool; definition: ToolSet[string] }[]>();

		for (const toolInstance of this.tools) {
			const serverId = toolInstance instanceof MCPTool ? toolInstance.serverId : 'Non-MCP';
			try {
				const currentToolSet = await toolInstance.setup();
				for (const toolName in currentToolSet) {
					if (Object.prototype.hasOwnProperty.call(currentToolSet, toolName)) {
						if (!discoveredTools.has(toolName)) {
							discoveredTools.set(toolName, []);
						}
						discoveredTools.get(toolName)!.push({
							instance: toolInstance,
							definition: currentToolSet[toolName]
						});
						console.log(`[ToolManager] Discovered tool "${toolName}" from ${serverId}`);
					}
				}
			} catch (error) {
				console.error(`[ToolManager] Failed to setup tools for ${serverId}:`, error);
			}
		}

		console.log(
			`[ToolManager] Tool discovery complete. Found ${discoveredTools.size} unique tool names.`
		);

		for (const [toolName, definitions] of discoveredTools.entries()) {
			if (definitions.length === 1) {
				const { instance, definition } = definitions[0];
				this.finalToolSet[toolName] = definition;
				this.finalToolMap.set(toolName, instance);
				console.log(
					`[ToolManager] Adding uncontested tool "${toolName}" from ${instance instanceof MCPTool ? instance.serverId : 'Non-MCP'}`
				);
			} else {
				console.warn(
					`[ToolManager] Conflict detected for tool "${toolName}". Resolving based on capability priority...`
				);
				console.warn(
					`[ToolManager]   Candidates for "${toolName}":`,
					definitions.map((d) => (d.instance instanceof MCPTool ? d.instance.serverId : 'Non-MCP'))
				);

				let chosenDefinition: { instance: AITool; definition: ToolSet[string] } | null = null;

				for (const def of definitions) {
					if (this.isDesignatedForPriority(def.instance)) {
						if (chosenDefinition) {
							console.error(
								`[ToolManager] CRITICAL CONFLICT: Multiple designated servers offer tool "${toolName}". Keeping the first designated one found: ${chosenDefinition.instance instanceof MCPTool ? chosenDefinition.instance.serverId : 'Non-MCP'}`
							);
						} else {
							chosenDefinition = def;
							console.log(
								`[ToolManager]   Priority given to "${toolName}" from designated server: ${def.instance instanceof MCPTool ? def.instance.serverId : 'Non-MCP'}`
							);
						}
					}
				}

				if (!chosenDefinition) {
					chosenDefinition = definitions[0];
					console.warn(
						`[ToolManager]   No designated server provided "${toolName}". Using first discovered instance from ${chosenDefinition.instance instanceof MCPTool ? chosenDefinition.instance.serverId : 'Non-MCP'}.`
					);
				}

				this.finalToolSet[toolName] = chosenDefinition.definition;
				this.finalToolMap.set(toolName, chosenDefinition.instance);
			}
		}

		console.log('[ToolManager] Final ToolSet constructed for LLM:', Object.keys(this.finalToolSet));
		console.log(
			'[ToolManager] Final Tool Instance Mapping:',
			Array.from(this.finalToolMap.entries()).map(
				([name, instance]) =>
					`  ${name} -> ${instance instanceof MCPTool ? instance.serverId : 'Non-MCP Tool'}`
			)
		);

		return this.finalToolSet;
	}

	async cleanupTools(): Promise<void> {
		console.log('[ToolManager] Cleaning up all tool instances...');
		await Promise.all(this.tools.map((tool) => tool.cleanup()));
		this.finalToolMap.clear();
		this.designatedServers.clear();
		console.log('[ToolManager] Cleanup complete.');
	}

	private parseSingleToolResult(toolResultData: {
		toolCallId: string;
		toolName: string;
		args: unknown;
		result: Record<string, unknown>;
	}): string {
		const toolInstance = this.finalToolMap.get(toolResultData.toolName);

		if (toolInstance) {
			try {
				const serverId = toolInstance instanceof MCPTool ? toolInstance.serverId : 'Non-MCP Tool';
				console.log(
					`[ToolManager] Parsing result for "${toolResultData.toolName}" using instance from ${serverId}`
				);
				// Ensure the result passed matches what parseToolResult expects
				const parsed = toolInstance.parseToolResult(toolResultData.result);
				return parsed ?? `Tool ${toolResultData.toolName} finished.`;
			} catch (parseError) {
				console.error(
					`[ToolManager] Error parsing result for tool ${toolResultData.toolName}:`,
					parseError
				);
				return `Error parsing result for tool ${toolResultData.toolName}. Raw result: ${JSON.stringify(toolResultData.result)}`;
			}
		}

		console.warn(
			`[ToolManager] Could not find the mapped tool instance for parsing result of tool: ${toolResultData.toolName}`
		);
		return JSON.stringify(toolResultData.result) ?? '';
	}

	parseToolResults(result: GenerateTextResult): string {
		if (result.text && typeof result.text === 'string' && result.text.trim() !== '') {
			console.log('[ToolManager] Result already contains text, returning directly:', result.text);
			return result.text;
		}

		if (!result.toolResults || result.toolResults.length === 0) {
			console.log('[ToolManager] No tool results found in the result object.');
			return '';
		}

		console.log(`[ToolManager] Parsing ${result.toolResults.length} tool result(s).`);
		return result.toolResults
			.map((toolResult) => {
				if (
					typeof toolResult !== 'object' ||
					toolResult === null ||
					!toolResult.toolName ||
					!toolResult.result // Check if result property exists
				) {
					console.warn('[ToolManager] Received malformed tool result:', toolResult);
					// Provide default structure for safety if possible, or skip
					return `[Received malformed tool result for call ID: ${typeof toolResult === 'object' && toolResult !== null && 'toolCallId' in toolResult ? toolResult.toolCallId : 'unknown'}]`;
				}
				// REMOVED THE CAST: toolResult already has the correct shape
				// parseSingleToolResult expects { toolCallId, toolName, args, result }
				// The elements from result.toolResults match this structure implicitly.
				return this.parseSingleToolResult(toolResult);
			})
			.filter(Boolean)
			.join('\n\n');
	}
}
