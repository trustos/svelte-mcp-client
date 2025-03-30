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

		config.model = option.value;
		config.provider = option.provider as string;

		// (value) => {
		// 	console.log(value);
		// 	// (config.model = value)
		// }
	};

	async function sendMessage() {
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

<div class="mx-auto flex h-[600px] max-w-2xl flex-col rounded-lg bg-white p-4 shadow-lg">
	<div class="mb-4 flex items-center">
		<h2 class="text-xl font-bold">Model &nbsp;</h2>
		<Dropdown options={GOOGLE} defaultValue={config.model} selectChanged={selectChangeHandler} />
	</div>
	<div class="mb-4 flex-1 space-y-4 overflow-y-auto">
		{#each messages as message}
			<div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
				<div
					class="max-w-[80%] rounded-lg p-3 {message.role === 'user'
						? 'bg-blue-500 text-white'
						: 'bg-gray-200'}"
				>
					{message.content}
				</div>
			</div>
		{/each}
		{#if isLoading}
			<div class="flex justify-start">
				<div class="rounded-lg bg-gray-200 p-3">Thinking...</div>
			</div>
		{/if}
	</div>

	<div class="flex gap-2">
		<input
			type="text"
			bind:value={inputMessage}
			onkeydown={(e) => e.key === 'Enter' && sendMessage()}
			placeholder="Type your message..."
			class="flex-1 rounded-lg border p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
		/>
		<button
			onclick={sendMessage}
			disabled={isLoading}
			class="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
		>
			Send
		</button>
	</div>
</div>
