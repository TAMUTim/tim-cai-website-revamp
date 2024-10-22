<script lang="ts">
	import { getFormattedDate } from '$lib/utils'
	import { page } from '$app/stores'
	import type { PageData } from './$types'
	import animatedSections from '$lib/stores/animatedSections'

	animatedSections.set(3)

	const currentPath = $page.url.pathname

	export let title = 'Blog - Tim Cai'
	export let data: PageData

	let postsByYear: App.PostYear[] = [
		{
			year: new Date().getFullYear(),
			posts: []
		}
	]

	for (const post of data.posts) {
		if (postsByYear[postsByYear.length - 1].year !== new Date(post.date).getFullYear()) {
			let newYearObj: App.PostYear = {
				year: new Date(post.date).getFullYear(),
				posts: [post]
			}

			postsByYear.push(newYearObj)
		} else {
			postsByYear[postsByYear.length - 1].posts.push(post)
		}
	}
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

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
		{#each postsByYear as { year, posts }}
			<div class="flex flex-col gap-4">
				<p class="text-4xl text-right font-nabla">{year}</p>
				<div class="flex flex-col gap-2">
					{#each posts as { title, slug, author, date, published, readTime }}
						<div class="text-right">
							<a href="/blog/{slug}" class="text-xl text-slate-300">
								{title}
								<span class="ml-3 text-right font-semibold text-xl text-slate-400 mt-2"
									>{getFormattedDate(date)} · {readTime} min</span
								>
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
