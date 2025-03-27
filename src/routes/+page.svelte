<script lang="ts">
	import { Chat } from '$components';
	import type { AIConfig } from '$types';

	const config: AIConfig = {
		provider: 'google',
		model: 'gemini-2.0-flash-001'
	};
</script>

<div class="container mx-auto py-8">
	<h1 class="mb-8 text-center text-3xl font-bold">AI Chat</h1>
	<Chat {config} />
</div>
