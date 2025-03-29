import type { AITool, Config } from '$types';
import { MCPTool } from './mcp.tool';

export class ToolFactory {
	static createTools(config: Config): AITool[] {
		return Object.entries(config.mcpServers).map(([_, serverConfig]) => {
			return new MCPTool(serverConfig);
		});
	}
}
