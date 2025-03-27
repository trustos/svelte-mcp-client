import type { GenerateTextResult, AITool, ToolsManager } from '$types';
import type { ToolSet } from 'ai';

export class AIToolsManager implements ToolsManager {
	constructor(private tools: AITool[]) {}

	async setupTools(): Promise<ToolSet> {
		const toolSets = await Promise.all(this.tools.map((tool) => tool.setup()));

		// Merge all tool sets into one
		return toolSets.reduce(
			(acc, toolSet) => ({
				...acc,
				...toolSet
			}),
			{}
		);
	}

	async cleanupTools(): Promise<void> {
		await Promise.all(this.tools.map((tool) => tool.cleanup()));
	}

	parseToolResults(result: GenerateTextResult): string {
		if (result.text) {
			return result.text;
		}

		if (!result.toolResults?.length) {
			return '';
		}

		return result.toolResults
			.map((toolResult) => {
				// Find the appropriate tool and parse the result
				for (const tool of this.tools) {
					const parsed = tool.parseToolResult(toolResult);
					if (parsed) return parsed;
				}
				return '';
			})
			.filter(Boolean)
			.join(' ');
	}
}
