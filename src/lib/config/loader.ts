import { readFileSync } from 'fs';
import { join } from 'path';
import type { Config, MCPServerConfig } from '$types';

// Simple dotenv parser implementation
function parse(content: string): Record<string, string> {
	const result: Record<string, string> = {};
	const lines = content.split('\n');

	for (const line of lines) {
		const trimmedLine = line.trim();
		// Skip comments and empty lines
		if (!trimmedLine || trimmedLine.startsWith('#')) continue;

		const equalsIndex = trimmedLine.indexOf('=');
		if (equalsIndex > 0) {
			const key = trimmedLine.slice(0, equalsIndex).trim();
			let value = trimmedLine.slice(equalsIndex + 1).trim();

			// Remove quotes if present
			if (
				(value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith("'") && value.endsWith("'"))
			) {
				value = value.slice(1, -1);
			}

			result[key] = value;
		}
	}

	return result;
}

// Helper function to replace environment variables in a string
function replaceEnvVars(str: string, envConfig: Record<string, string>): string {
	if (!str) return str;

	return str.replace(/\$\{([\w-]+)\}/g, (match: string, key: string) => {
		const value = envConfig[key];
		if (value === undefined) {
			console.warn(`Environment variable not found: ${key}`);
			return match; // Keep the original placeholder
		}
		console.log(`Replaced environment variable ${key} with its value`);
		return value;
	});
}

// Helper to process all string properties recursively
function processObjectEnvVars(obj: unknown, envConfig: Record<string, string>): unknown {
	if (!obj || typeof obj !== 'object') return obj;

	if (Array.isArray(obj)) {
		return obj.map((item) => processObjectEnvVars(item, envConfig));
	}

	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(obj)) {
		if (typeof value === 'string') {
			result[key] = replaceEnvVars(value, envConfig);
		} else if (typeof value === 'object') {
			result[key] = processObjectEnvVars(value, envConfig);
		} else {
			result[key] = value;
		}
	}

	return result;
}

export function loadConfig(configPath: string = 'mcp-config.json'): Config {
	// Load environment variables from .env file
	let envConfig: Record<string, string> = {};
	try {
		const envContent = readFileSync(join(process.cwd(), '.env'), { encoding: 'utf8' });
		envConfig = parse(envContent);
		console.log('Loaded environment variables:', Object.keys(envConfig));
	} catch (err) {
		console.warn('Could not load .env file, environment variables will not be replaced', err);
	}

	try {
		const fullPath = join(process.cwd(), configPath);
		try {
			const configFile = readFileSync(fullPath, 'utf-8');
			const configOriginal = JSON.parse(configFile);

			// Validate the config structure
			if (!configOriginal.mcpServers || typeof configOriginal.mcpServers !== 'object') {
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

			// First make a deep copy of the config and process all environment variables in all properties
			const config = JSON.parse(JSON.stringify(configOriginal));

			console.log('Processing configuration for environment variables');
			console.log('Available environment variables:', Object.keys(envConfig).join(', '));

			// Process all properties in the config for environment variables
			for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
				config.mcpServers[serverName] = processObjectEnvVars(serverConfig, envConfig);
				console.log(`Processed server configuration: ${serverName}`);

				// Additional debug logging for this server's command and args
				const processedServer = config.mcpServers[serverName] as MCPServerConfig;
				if (processedServer.command) {
					console.log(`Server ${serverName} command: ${processedServer.command}`);
				}
				if (processedServer.args && processedServer.args.length > 0) {
					console.log(`Server ${serverName} args:`, processedServer.args);
				}
			}

			// Validate each server configuration after replacing environment variables
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
