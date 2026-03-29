<svelte:head>
    <title>{data.frontmatter.title}</title>
</svelte:head>

<script lang="ts">
    import { getFormattedDate } from '$lib/utils';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();
    let Component = $derived(data.component);
</script>

<div class="flex flex-col items-center justify-center font-ibm mt-6 sm:mt-10">
    <div class="w-full max-w-[40rem] px-5 sm:px-0" style="--stagger: 1" data-animate>
        <p class="text-2xl sm:text-4xl text-slate-300 font-semibold">{ data.frontmatter.title }</p>
        <p class="mt-4 text-slate-400 text-lg sm:text-2xl">{ getFormattedDate(data.frontmatter.date) } · { data.frontmatter.readTime } min</p>
    </div>

    <div class="w-full max-w-[40rem] px-5 sm:px-0 text-slate-300 text-lg mt-10" style="--stagger: 2" data-animate>
        <Component />
    </div>
</div>
