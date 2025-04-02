<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
	import { tick } from 'svelte';
	import * as Command from '$shadcn/components/ui/command';
	import * as Popover from '$shadcn/components/ui/popover';
	import { Button } from '$shadcn/components/ui/button';
	import { cn } from '$shadcn/utils';
	import { type DropdownOptions } from '$types';

	type Props = {
		options: DropdownOptions[];
		placeholder?: string;
		defaultValue?: unknown;
		selectChanged: (value: DropdownOptions | undefined) => void;
	};

	let {
		options,
		placeholder = 'Select an option...',
		defaultValue = '',
		selectChanged
	}: Props = $props();

	// const options = [
	// 	{
	// 		value: 'sveltekit',
	// 		label: 'SvelteKit'
	// 	},
	// 	{
	// 		value: 'next.js',
	// 		label: 'Next.js'
	// 	},
	// 	{
	// 		value: 'nuxt.js',
	// 		label: 'Nuxt.js'
	// 	},
	// 	{
	// 		value: 'remix',
	// 		label: 'Remix'
	// 	},
	// 	{
	// 		value: 'astro',
	// 		label: 'Astro'
	// 	}
	// ];

	let open = $state(false);
	let value = $state(defaultValue);
	let triggerRef = $state<HTMLButtonElement>(null!);

	const selectedValue = $derived(options.find((f) => f.value === value)?.label ?? placeholder);

	$effect(() => {
		const selectedOption = options.find((f) => f.label === selectedValue);

		selectChanged(selectedOption);
	});

	// We want to refocus the trigger button when the user selects
	// an item from the list so users can continue navigating the
	// rest of the form with the keyboard.
	function closeAndFocusTrigger() {
		open = false;
		tick().then(() => {
			triggerRef.focus();
		});
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger bind:ref={triggerRef}>
		{#snippet child({ props })}
			<Button
				variant="outline"
				class="w-[200px] justify-between"
				{...props}
				role="combobox"
				aria-expanded={open}
			>
				{selectedValue || 'Select a framework...'}
				<ChevronsUpDown class="opacity-50" />
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-[200px] p-0">
		<Command.Root>
			<Command.Input placeholder="Search framework..." class="h-9" />
			<Command.List>
				<Command.Empty>No framework found.</Command.Empty>
				<Command.Group>
					{#each options as framework (framework.value)}
						<Command.Item
							value={framework.value}
							onSelect={() => {
								value = framework.value;
								closeAndFocusTrigger();
							}}
						>
							<Check class={cn(value !== framework.value && 'text-transparent')} />
							{framework.label}
						</Command.Item>
					{/each}
				</Command.Group>
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
