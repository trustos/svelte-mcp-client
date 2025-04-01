<script lang="ts">
	import { type Message, type AIConfig, GOOGLE, type DropdownOptions } from '$types';
	import { Dropdown } from '$components';

	type Props = {
		config: AIConfig;
	};

	let { config }: Props = $props();

	let messages: Message[] = $state([]);
	let inputMessage = $state('');
	let isLoading = $state(false);

	const selectChangeHandler = (option: DropdownOptions | undefined) => {
		if (!option) {
			return;
		}

		config.model = option.value as typeof config.model;
		config.provider = option.provider as string;
	};

	async function sendMessage(event?: SubmitEvent) {
		if (event) event.preventDefault();

		const trimmedMessage = inputMessage.trim();
		if (!trimmedMessage || isLoading) return;

		const userMessage: Message = { role: 'user', content: trimmedMessage };
		messages = [...messages, userMessage];
		inputMessage = '';
		isLoading = true;

		try {
			const response = await fetch('/api/chat', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					messages: messages.filter((msg) => msg.content?.trim()), // Filter out empty messages
					config
				})
			});

			if (!response.ok) throw new Error('Failed to get response');

			const data: Message = await response.json();

			if (typeof data.content === 'string' && (data.role === 'assistant' || data.role === 'user')) {
				messages = [...messages, data];
			} else {
				throw new Error('Invalid response format');
			}
		} catch (error) {
			console.error('Error:', error);
			messages = [
				...messages,
				{ role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }
			];
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="flex h-[80vh] flex-col space-y-4">
	<div class="mb-4 flex items-center">
		<h2 class="text-xl font-bold">Model &nbsp;</h2>
		<Dropdown
			options={[...GOOGLE]}
			defaultValue={config.model}
			selectChanged={selectChangeHandler}
		/>
	</div>

	<div class="flex-1 overflow-y-auto rounded-lg border p-4">
		{#each messages as message}
			<div class="mb-4 flex flex-col {message.role === 'user' ? 'items-end' : 'items-start'}">
				<div
					class="max-w-[80%] rounded-lg p-4 {message.role === 'user'
						? 'bg-primary text-primary-foreground'
						: 'bg-muted'}"
				>
					<p class="whitespace-pre-wrap">{message.content}</p>
				</div>
			</div>
		{/each}

		{#if isLoading}
			<div class="flex items-center space-x-2">
				<div class="h-2 w-2 animate-pulse rounded-full bg-primary"></div>
				<div class="animation-delay-200 h-2 w-2 animate-pulse rounded-full bg-primary"></div>
				<div class="animation-delay-400 h-2 w-2 animate-pulse rounded-full bg-primary"></div>
			</div>
		{/if}
	</div>

	<form onsubmit={sendMessage} class="flex items-center space-x-2">
		<input
			type="text"
			bind:value={inputMessage}
			placeholder="Type your message..."
			class="flex-1 rounded-lg border px-4 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
		/>
		<button
			type="submit"
			disabled={isLoading}
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
