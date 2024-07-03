<svelte:head>
    <title>{title}</title>
</svelte:head>

<script lang="ts">
    import { getFormattedDate } from "$lib/utils";
    import { page } from '$app/stores';
    import type { PageData } from './$types'

    const currentPath = $page.url.pathname;

    export let title = "Notes - Tim Cai";
    export let data: PageData;

    let notesByYear: App.NoteYear[] = [];

    for(const post of data.notes) {
        if(notesByYear.length === 0 || (notesByYear[notesByYear.length - 1].topic !== post.topic)) {
            notesByYear.push(
                {
                    topic: post.topic,
                    notes: [post]
                }
            );
        } else {
            notesByYear[notesByYear.length - 1].notes.push(post);
        }
    }
</script>

<div class="flex flex-col items-center justify-center font-ibm mt-10">
    <div class="w-content flex flex-row gap-4 font-nabla" style="--stagger: 1" data-animate>
        <a href="/blog" class={currentPath === '/blog' ? 'active' : 'inactive'}>
            <p class="text-4xl font-semibold text-slate-50">Blog</p>
        </a>
        <a href="/notes" class={currentPath === '/notes' ? 'active' : 'inactive'}>
            <p class="text-4xl font-semibold text-slate-50">Notes</p>
        </a>
    </div>

    <div class="w-content flex flex-col mt-14 gap-16" style="--stagger: 2" data-animate>
        {#each notesByYear as { topic, notes }}
            <div class="flex flex-col gap-4">
                <p class="text-4xl font-nabla text-right">{ topic }</p>
                <div class="flex flex-col gap-2">
                    {#each notes as { title, slug, author, date, published, topic, readTime }}
                        <div class="text-right">
                            <a href="/notes/{slug}" class="text-xl text-slate-300">
                                {title}
                                <span class="ml-3 text-right font-semibold text-xl text-slate-400 mt-2">{readTime} min</span>
                            </a>
                        </div>
                    {/each}
                </div>
            </div>
        {/each}
    </div>
</div>

<style>
    a {
        color: rgb(248 250 252);
        text-decoration: none;
        cursor: pointer;
        transition: opacity 0.2s ease-in-out;
        opacity: 0.6;
    }

    a:hover {
        opacity: 1;
    }

    .inactive {
        opacity: 0.3;
        transition: opacity 0.2s ease-in-out;
    }

    .inactive:hover {
        opacity: 0.6;
    }

    .active {
        opacity: 1;
        border-bottom: 1px solid var(--c-bg);
        transition: border 0.2s ease-in-out;
    }

    .active:hover {
        border-bottom: 1px solid var(--c-accent-secondary);
    }
</style>