import type { AITool, Config } from '$types';
import { MCPTool } from './mcp.tool';

export class ToolFactory {
	static createTools(config: Config): AITool[] {
		// Capture both the serverId (key) and serverConfig (value)
		return Object.entries(config.mcpServers).map(([serverId, serverConfig]) => {
			// Pass BOTH arguments to the constructor
			return new MCPTool(serverConfig, serverId);
		});
	}
}
