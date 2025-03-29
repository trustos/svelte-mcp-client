import type { ToolSet } from 'ai';
import type { AITool, MCPServerConfig } from '$types';

export abstract class BaseMCPTool implements AITool {
	constructor(protected config: MCPServerConfig) {}

	abstract setup(): Promise<ToolSet>;
	abstract cleanup(): Promise<void>;
	abstract parseToolResult(result: unknown): string;
}
