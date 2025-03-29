import { readFileSync } from 'fs';
import { join } from 'path';
import type { Config, MCPServerConfig } from '$types';

export function loadConfig(configPath: string = 'mcp-config.json'): Config {
	try {
		const fullPath = join(process.cwd(), configPath);
		try {
			const configFile = readFileSync(fullPath, 'utf-8');
			const config = JSON.parse(configFile);

			// Validate the config structure
			if (!config.mcpServers || typeof config.mcpServers !== 'object') {
				throw new Error('Invalid config format: missing or invalid mcpServers object');
			}

			// Type guard function to check if an object is a valid MCPServerConfig
			function isMCPServerConfig(value: unknown): value is MCPServerConfig {
				return (
					typeof value === 'object' &&
					value !== null &&
					'command' in value &&
					typeof (value as MCPServerConfig).command === 'string' &&
					'args' in value &&
					Array.isArray((value as MCPServerConfig).args) &&
					(value as MCPServerConfig).args.every((arg) => typeof arg === 'string')
				);
			}

			// Validate each server configuration
			for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
				if (!isMCPServerConfig(serverConfig)) {
					throw new Error(
						`Invalid server configuration for "${serverName}": missing command or invalid args`
					);
				}
			}

			return config as Config;
		} catch (e) {
			if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
				throw new Error(`Config file not found at: ${fullPath}`);
			}
			if (e instanceof SyntaxError) {
				throw new Error(`Invalid JSON in config file: ${e.message}`);
			}
			throw new Error(`Error reading config file: ${e instanceof Error ? e.message : String(e)}`);
		}
	} catch (error) {
		console.error('Configuration error:', error);
		throw error;
	}
}
