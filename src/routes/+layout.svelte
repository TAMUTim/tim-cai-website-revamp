<script lang="ts">
    import '$lib/styles/main.css'
    import '@fortawesome/fontawesome-free/css/all.min.css'
    import { browser } from "$app/environment";
    import { navigating, page } from '$app/stores';
    import { onDestroy } from 'svelte';

    import NProgress from 'nprogress';

    // Stores
    import animatedSections from '$lib/stores/animatedSections';

    // Components
    import Dots from '$lib/components/Dots.svelte';

    // Assets
    import GoobImage from '$lib/assets/goob.png';
    import Resume from '$lib/assets/tim_cai_resume.pdf';
    import GoobFavicon from '$lib/assets/favicons/favicon.ico';

    let y: number;
    let cWidth: string;
    let numSections = 0;

    $: renderDots = !($page.url.pathname.includes('blog/') || $page.url.pathname.includes('notes/'));
    $: {
        if ($navigating) {
            NProgress.start();
        }
        else {
            NProgress.done();
        }
    }
    $: {
        if($page.url.pathname.includes('hundred')) {
            cWidth = 'hundred';
        }
        else {
            cWidth = 'content';
        }
    }

    animatedSections.subscribe((sections) => {
        numSections = sections;
    });

    function scrollToTop() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }
</script>

<svelte:head>
    <link rel="shortcut icon" href={GoobFavicon} />
</svelte:head>

<svelte:window bind:scrollY={y} />

{#if browser && renderDots}
    <Dots />
{/if}

<nav class="font-ibm z-10 sticky top-0">
    <div class="mx-auto px-2 py-2 sm:px-6 lg:px-8">
        <div class="relative flex h-16 items-center justify-between">
            <div class="flex flex-1 items-center justify-center sm:items-stretch sm:justify-start">
                <a class="flex flex-shrink-0 items-center" href="/">
                    <img class="h-10 w-auto" src={GoobImage} alt="really cool drawing of me">
                </a>
            </div>
            <div class="nav-links font-nabla absolute inset-y-0 right-0 flex items-center pr-2 sm:static sm:inset-auto sm:ml-6 sm:pr-0">
                <div>
                    <a class="text-lg font-semibold mr-6" href="/blog">Blog</a>
                </div>
                <div>
                    <a class="text-lg font-semibold mr-6" href="/notes">Notes</a>
                </div>
                <div>
                    <a class="text-lg font-semibold mr-6" href="/projects">Projects</a>
                </div>
                <div>
                    <a class="text-lg font-semibold mr-6" href="/hundred">100</a>
                </div>
                <div>
                    <a class="text-lg font-semibold mr-6" href={Resume} target="_blank">Resume</a>
                </div>
                <div>
                    <a class="text-lg" target="_blank" href="https://github.com/TAMUTim">
                        <i class="fa-brands fa-github"></i>
                    </a>
                </div>
                <div>
                    <a class="text-lg" target="_blank" href="https://www.linkedin.com/in/tim-cai/">
                        <i class="fa-brands fa-linkedin"></i>
                    </a>
                </div>
            </div>
        </div>
    </div>
</nav>

<slot />

<button
        title="Scroll to the top"
        class="fixed right-3 bottom-3 w-10 h-10 rounded-full z-100 print:hidden text-slate-200 {y > 10 ? 'opacity-100' : 'opacity-0'}"
        on:click={scrollToTop}
>
    <i class="fa-solid fa-arrow-up"></i>
</button>

{#key $page.url.pathname}
    <div class="flex flex-row items-center justify-center font-ibm">
        <div class="mt-10 mb-6 w-{cWidth}" style="--stagger: {numSections + 1}" data-animate>
            <span class="text-sm font-semibold text-slate-300">2024-Death CC Tim Cai</span>
            <div class="flex-auto" />
        </div>
    </div>
{/key}

<style>
.nav-links a {
    color: var(--c-slate-50);
    text-decoration: none;
    cursor: pointer;
    transition: opacity 0.2s ease-in-out;
    opacity: 0.6;
    outline: none;
}

.nav-links a:hover {
    opacity: 1;
    text-decoration-color: inherit;
}
</style>