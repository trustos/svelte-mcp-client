import type { DataStreamWriter } from 'ai';
import { GOOGLE, OLLAMA_MODELS } from './constants';

export interface Message {
	role: 'user' | 'assistant' | 'system' | 'tool';
	content: string | unknown;
	name?: string;
	tool_call_id?: string;
	isError?: boolean;
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

export type GoogleModel = (typeof GOOGLE)[number]['value'];
export type OllamaModel = (typeof OLLAMA_MODELS)[number];

// Then in your AIConfig interface:
export interface GoogleAIConfig {
	provider: 'google';
	model?: GoogleModel;
	options?: Record<string, unknown>;
}

export interface OllamaAIConfig {
	provider: 'ollama';
	model?: OllamaModel;
	options?: Record<string, unknown>;
	baseUrl?: string;
}

export interface OtherAIConfig {
	provider: string;
	model?: string;
	options?: Record<string, unknown>;
	baseUrl?: string;
}

export type AIConfig = GoogleAIConfig | OllamaAIConfig | OtherAIConfig;
