<svelte:head>
    <title>{title}</title>
</svelte:head>

<script lang="ts">
    import { getFormattedDate } from '$lib/utils';
    import type { PageData } from './$types';

    export let data: PageData;
    export let title = data.frontmatter.title;
    $: component = data.component;
</script>

<div class="flex flex-col items-center justify-center font-ibm mt-10">
    <div class="w-content" style="--stagger: 1" data-animate>
        <p class="text-4xl text-slate-300 font-nabla font-semibold">{ data.frontmatter.title }</p>
        <p class="mt-4 text-slate-400 text-2xl">{ getFormattedDate(data.frontmatter.date) } · { data.frontmatter.readTime } min</p>
    </div>

    <div class="w-content text-slate-300 mt-8 prose prose-content" style="--stagger: 2" data-animate>
        <svelte:component this={component} />
    </div>
</div>