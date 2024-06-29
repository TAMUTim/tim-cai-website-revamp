<svelte:head>
    <title>{title}</title>
</svelte:head>

<script lang="ts">
    import { getFormattedDate } from "$lib/utils";
    import { page } from '$app/stores';
    import type { PageData } from './$types'

    const currentPath = $page.url.pathname;

    export let title = "Blog - Tim Cai";
    export let data: PageData;

    let postsByYear: App.PostYear[] = [
        {
            year: new Date().getFullYear(),
            posts: []
        }
    ];

    for(const post of data.posts) {
        if(postsByYear[postsByYear.length - 1].year !== new Date(post.date).getFullYear()) {
            let newYearObj: App.PostYear = {
                year: new Date(post.date).getFullYear(),
                posts: [post]
            }

            postsByYear.push(newYearObj);
        } else {
            postsByYear[postsByYear.length - 1].posts.push(post);
        }
    }
</script>

<div class="flex flex-col items-center justify-center font-ibm mt-10">
    <div class="w-1/4 flex flex-row gap-4" style="--stagger: 1" data-animate>
        <a href="/blog" class={currentPath === '/blog' ? 'active' : 'inactive'}>
            <p class="text-4xl font-semibold text-slate-50">Blog</p>
        </a>
        <a href="/notes" class={currentPath === '/notes' ? 'active' : 'inactive'}>
            <p class="text-4xl font-semibold text-slate-50">Notes</p>
        </a>
    </div>

    <div class="prose w-1/4 flex flex-col mt-14 gap-16" style="--stagger: 2" data-animate>
        {#each postsByYear as { year, posts }}
            <div>
                <p class="text-3xl text-right font-semibold text-orange-400">{ year }</p>
                {#each posts as { title, slug, author, date, published, readTime }}
                    <div class="flex flex-col gap-2">
                        <div class="text-right mt-2">
                            <a href="/blog/{slug}" class="text-xl text-slate-300">
                                {title}
                                <span class="ml-3 text-right font-semibold text-xl text-slate-400 mt-2">{getFormattedDate(date)}</span>
                                <span class="text-right font-semibold text-xl text-slate-400 mt-2">· {readTime} min</span>
                            </a>
                        </div>
                    </div>
                {/each}
            </div>
        {/each}
    </div>
</div>

<style>
    .prose a {
        color: rgb(248 250 252);
        text-decoration: none;
        cursor: pointer;
        transition: opacity 0.2s ease-in-out;
        opacity: 0.6;
    }

    .prose a:hover {
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
        border-bottom: 1px solid var(--c-slate-50);
    }
</style>