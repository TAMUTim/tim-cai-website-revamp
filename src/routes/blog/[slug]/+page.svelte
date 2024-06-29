<svelte:head>
    <title>{title}</title>
</svelte:head>

<script lang="ts">
    import { getFormattedDate } from '$lib/utils';
    import type { PageData } from './$types';
    import type { SvelteComponent } from "svelte";

    export let data: PageData;
    export let title = data.frontmatter.title;
    type C = $$Generic<typeof SvelteComponent<any, any, any>>;
    $: component = data.component as unknown as C;
</script>

<div class="flex flex-col items-center justify-center font-ibm mt-10">
    <div class="w-1/4" style="--stagger: 1" data-animate>
        <p class="text-4xl text-slate-300 font-semibold">{ data.frontmatter.title }</p>
        <p class="mt-4 text-slate-400 text-2xl">{ getFormattedDate(data.frontmatter.date) } · { data.frontmatter.readTime } min</p>
    </div>

    <div class="w-1/4 text-slate-300 text-lg mt-10" style="--stagger: 2" data-animate>
        <svelte:component this={component} />
    </div>
</div>