<svelte:head>
    <title>{data.frontmatter.title} — Tim Cai</title>
    <meta name="description" content="{data.frontmatter.title} by {data.frontmatter.author}" />
    <meta property="og:title" content={data.frontmatter.title} />
    <meta property="og:description" content="{data.frontmatter.title} by {data.frontmatter.author}" />
    <meta property="og:url" content={$page.url.href} />
    <meta property="og:type" content="article" />
    <meta property="article:published_time" content={data.frontmatter.date} />
    <meta property="article:author" content={data.frontmatter.author} />
    <link rel="canonical" href={$page.url.href} />
</svelte:head>

<script lang="ts">
    import { page } from '$app/stores';
    import { getFormattedDate } from '$lib/utils';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();
    let component = $derived(data.component);
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