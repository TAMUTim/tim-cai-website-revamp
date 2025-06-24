<svelte:head>
    <title>{pageTitle}</title>
</svelte:head>

<script lang="ts">
    import animatedSections from '$lib/stores/animatedSections';

    animatedSections.set(2);

    export let pageTitle = "100 - Tim Cai";
    export let data;

    const titles = data.titles;
</script>

<div class="flex items-center justify-center mt-20">
    <div class="flex flex-col flex-wrap mt-10 w-content border-2 min-h-[45rem] font-ibmMono" style="--stagger: 1" data-animate>
        {#each titles as title, i}
            <a class="text-slate-50 mt-3 ml-3" href="/hundred/{title}">
                {i}. {title}
            </a>
        {/each}
    </div>
</div>


<style>
    a {
        color: var(--c-slate-50);
        cursor: pointer;
        transition: opacity 0.2s ease-in;
        opacity: 0.6;
    }

    a:hover {
        opacity: 1;
    }
</style>