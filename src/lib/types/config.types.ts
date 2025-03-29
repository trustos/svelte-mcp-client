export interface MCPServerConfig {
	command: string;
	args: string[];
}

export interface Config {
	mcpServers: Record<string, MCPServerConfig>;
}
