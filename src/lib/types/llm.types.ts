import type { Tool, ToolSet } from 'ai';

export interface Message {
	role: 'user' | 'assistant' | 'system';
	content: string;
}

export interface TextContent {
	type: 'text';
	text: string;
}

export interface ImageContent {
	type: 'image';
	data: string;
	mimeType: string;
}

export interface ResourceContent {
	type: 'resource';
	resource: {
		uri: string;
		mimeType?: string;
		text?: string;
	};
}

export type ContentItem = TextContent | ImageContent | ResourceContent;

export interface ToolResult {
	type: 'tool-result';
	toolCallId: string;
	toolName: string;
	args: unknown;
	result: Record<string, unknown> & {
		content?: ContentItem[];
	};
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

export interface LLMResponse {
	role: 'assistant';
	content: string;
}

export interface LLMProvider {
	generateResponse(messages: Message[]): Promise<LLMResponse>;
}

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

export type AIProvider = 'google' | 'openai' | 'anthropic';

export interface AIConfig {
	provider: AIProvider; // add more providers as needed
	model?: string;
	options?: Record<string, unknown>;
}
