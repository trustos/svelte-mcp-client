import type { DataStreamWriter } from 'ai';

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

export interface LLMResponse {
	role: 'assistant';
	content: string;
}

export interface LLMProvider {
	generateResponse(messages: Message[]): Promise<LLMResponse>;
	generateStreamResponse(messages: Message[], dataStream: DataStreamWriter): Promise<void>;
}

// export type AIProvider = 'google' | 'openai' | 'anthropic';

export interface AIConfig {
	provider: string; // add more providers as needed
	model?: string;
	options?: Record<string, unknown>;
}
