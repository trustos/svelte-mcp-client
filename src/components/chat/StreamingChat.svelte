<script lang="ts">
	import { Chat } from '@ai-sdk/svelte';
	// import type { Me } from 'ai';

	let { config } = $props();

	// interface ChatInstance extends Chat {
	// 	messages: ChatCompletionMessage[];
	// 	input: string;
	// 	handleSubmit: (event: SubmitEvent) => Promise<void>;
	// 	status: 'submitted' | 'streaming' | 'ready' | 'error';
	// }

	const chat = new Chat({
		api: '/api/chat/stream',
		maxSteps: 5,
		body: {
			config
		},
		onError: (error: Error) => {
			console.error('Chat error:', error);
		}
	});
</script>

<div class="flex h-[80vh] flex-col space-y-4">
	<div class="flex-1 overflow-y-auto rounded-lg border p-4">
		{#each chat.messages as message (message.id)}
			<div class="mb-4 flex flex-col {message.role === 'user' ? 'items-end' : 'items-start'}">
				<div
					class="max-w-[80%] rounded-lg p-4 {message.role === 'user'
						? 'bg-primary text-primary-foreground'
						: 'bg-muted'}"
				>
					{#if message.parts}
						{#each message.parts as part}
							{#if part.type === 'text'}
								<p class="whitespace-pre-wrap">{part.text}</p>
							{:else if part.type === 'tool-invocation'}
								<div class="prose-sm mt-2">
									<p class="font-semibold">Using tool: {part.toolInvocation.toolName}</p>
									{#if part.toolInvocation.state === 'result'}
										<pre class="mt-1 rounded bg-muted-foreground/10 p-2 text-xs">
        {JSON.stringify(part.toolInvocation.result, null, 2)}
      </pre>
									{:else if part.toolInvocation.state === 'call'}
										<p>Calling tool...</p>
									{:else if part.toolInvocation.state === 'partial-call'}
										<p>Preparing tool call...</p>
									{/if}
								</div>
							{/if}
						{/each}
					{:else}
						<p class="whitespace-pre-wrap">{message.content}</p>
					{/if}
				</div>
			</div>
		{/each}

		{#if chat.status === 'streaming' || chat.status === 'submitted'}
			<div class="flex items-center space-x-2">
				<div class="h-2 w-2 animate-pulse rounded-full bg-primary"></div>
				<div class="animation-delay-200 h-2 w-2 animate-pulse rounded-full bg-primary"></div>
				<div class="animation-delay-400 h-2 w-2 animate-pulse rounded-full bg-primary"></div>
			</div>
		{/if}
	</div>

	<form onsubmit={chat.handleSubmit} class="flex items-center space-x-2">
		<input
			type="text"
			bind:value={chat.input}
			placeholder="Type your message..."
			class="flex-1 rounded-lg border px-4 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
		/>
		<button
			type="submit"
			disabled={chat.status === 'streaming' || chat.status === 'submitted'}
			class="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
		>
			Send
		</button>
	</form>
</div>

<style>
	.animation-delay-200 {
		animation-delay: 200ms;
	}
	.animation-delay-400 {
		animation-delay: 400ms;
	}
</style>
