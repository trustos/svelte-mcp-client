<script lang="ts">
	import { Chat, StreamingChat } from '$components';
	import type { AIConfig } from '$types';

	const config: AIConfig = {
		provider: 'google',
		model: 'gemini-2.0-flash-001'
		// model: 'gemini-2.5-pro-exp-03-25'
		// provider: 'ollama',
		// model: 'zoyer2/Qwen2.5-Coder-7B-Instruct-Q4_K_M-64K-CLINE'
		// model: 'qwen2.5:7b'
	};
</script>

<div class="container mx-auto py-8">
	<h1 class="mb-8 text-center text-3xl font-bold">AI Chat</h1>
	<!-- <Chat {config} /> -->
	<StreamingChat {config} />
</div>
