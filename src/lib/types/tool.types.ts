import type { ToolSet, Tool } from 'ai';

export interface AITool {
	setup(): Promise<ToolSet>;
	cleanup(): Promise<void>;
	parseToolResult(result: unknown): string;
}

export interface ToolsManager {
	setupTools(): Promise<ToolSet>;
	cleanupTools(): Promise<void>;
	parseToolResults(results: unknown): string;
}

export interface GenerateTextResult {
	text?: string;
	toolResults?: Array<{
		type: 'tool-result';
		toolCallId: string;
		toolName: string;
		args: unknown;
		result: Record<string, unknown>;
	}>;
	tools?: Record<string, Tool>;
}
