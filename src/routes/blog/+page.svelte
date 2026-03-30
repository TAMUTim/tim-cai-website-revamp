<svelte:head>
    <title>Blog — Tim Cai</title>
    <meta name="description" content="Blog posts by Tim Cai" />
    <meta property="og:title" content="Blog — Tim Cai" />
    <meta property="og:description" content="Blog posts by Tim Cai" />
</svelte:head>

<script lang="ts">
    import { getFormattedDate } from "$lib/utils";
    import { page } from '$app/stores';
    import type { PageData } from './$types';
    import { animatedSections } from '$lib/stores/animatedSections.svelte';

    animatedSections.set(3);

    let { data }: { data: PageData } = $props();

    let postsByYear: App.PostYear[] = $derived.by(() => {
        const result: App.PostYear[] = [
            {
                year: new Date().getFullYear(),
                posts: []
            }
        ];

        for(const post of data.posts) {
            if(result[result.length - 1].year !== new Date(post.date).getFullYear()) {
                let newYearObj: App.PostYear = {
                    year: new Date(post.date).getFullYear(),
                    posts: [post]
                }

                result.push(newYearObj);
            } else {
                result[result.length - 1].posts.push(post);
            }
        }

        return result;
    });
</script>

<div class="flex flex-col items-center justify-center font-ibm mt-6 sm:mt-10">
    <div class="w-full max-w-[40rem] px-5 sm:px-0 flex flex-row gap-4 font-nabla" style="--stagger: 1" data-animate>
        <a href="/blog" class={$page.url.pathname === '/blog' ? 'active' : 'inactive'}>
            <p class="text-2xl sm:text-4xl font-semibold text-slate-50">Blog</p>
        </a>
        <a href="/notes" class={$page.url.pathname === '/notes' ? 'active' : 'inactive'}>
            <p class="text-2xl sm:text-4xl font-semibold text-slate-50">Notes</p>
        </a>
    </div>

    <div class="w-full max-w-[40rem] px-5 sm:px-0 flex flex-col mt-8 sm:mt-14 gap-10 sm:gap-16" style="--stagger: 2" data-animate>
        {#each postsByYear as { year, posts }}
            <div class="flex flex-col gap-4">
                <p class="text-2xl sm:text-4xl text-left sm:text-right font-nabla">{ year }</p>
                <div class="flex flex-col gap-2">
                    {#each posts as { title, slug, author, date, published, readTime }}
                        <div class="text-left sm:text-right">
                            <a href="/blog/{slug}" class="text-xl text-slate-300">
                                {title}
                                <span class="block sm:inline ml-0 sm:ml-3 text-right font-semibold text-base sm:text-xl text-slate-400 mt-1 sm:mt-2">{getFormattedDate(date)} · {readTime} min</span>
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
        color: var(--c-slate-50);
        cursor: pointer;
        transition: opacity 0.2s ease-in;
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