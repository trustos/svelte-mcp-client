export interface MCPServerConfig {
	command: string;
	args: string[];
	// Make capabilities non-optional if routing depends on it,
	// or handle cases where it's missing gracefully.
	// Using specific known types helps, but keep string for flexibility.
	capabilities: ('filesystem' | 'search' | 'booking' | string)[];
	env?: NodeJS.ProcessEnv;
}

export interface Config {
	mcpServers: {
		[serverId: string]: MCPServerConfig; // Use serverId as the key type
	};
}
