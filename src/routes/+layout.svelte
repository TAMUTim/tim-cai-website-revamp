<script lang="ts">
    import '$lib/styles/main.css'
    import '@fortawesome/fontawesome-free/css/all.min.css'
    import { browser } from "$app/environment";

    import { navigating, page } from '$app/stores';
    import { animatedSections } from '$lib/stores/animatedSections.svelte';

    import NProgress from 'nprogress';

    import ShaderBackground from '$lib/components/ShaderBackground.svelte';
    import { createFlowField } from '$lib/components/shaders/flowField';

    // Assets
    import GoobImage from '$lib/assets/goob.png';

    import GoobFavicon from '$lib/assets/favicons/favicon.ico';

    let { children } = $props();

    $effect(() => {
        if ($navigating) {
            NProgress.start();
        } else {
            NProgress.done();
        }
    });

    function scrollToTop() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    let y: number = $state(0);

    let menuOpen = $state(false);

    $effect(() => {
        $page.url.pathname;
        menuOpen = false;
    });

    let renderBackground = $derived(!($page.url.pathname.includes('blog/') || $page.url.pathname.includes('notes/')));
</script>

<svelte:head>
    <link rel="shortcut icon" href={GoobFavicon} />
    <meta name="description" content="Tim Cai — software engineer, writer, and maker of things." />
    <meta property="og:title" content="Tim Cai" />
    <meta property="og:description" content="Tim Cai — software engineer, writer, and maker of things." />
    <meta property="og:url" content={$page.url.href} />
    <meta property="og:type" content="website" />
    <link rel="canonical" href={$page.url.href} />
</svelte:head>

<svelte:window bind:scrollY={y} />

<a href="#main-content" class="skip-link">Skip to content</a>

{#if browser && renderBackground}
    <ShaderBackground createShader={createFlowField} />
{/if}

<nav class="font-ibm z-10 sticky top-0 bg-black/80 backdrop-blur-sm">
    <div class="mx-auto px-4 py-2 sm:px-6 lg:px-8">
        <div class="relative flex h-16 items-center justify-between">
            <div class="flex flex-1 items-center justify-start">
                <a class="flex flex-shrink-0 items-center" href="/">
                    <img class="h-8 w-auto" src={GoobImage} alt="really cool drawing of me">
                </a>
            </div>
            <button
                class="sm:hidden text-slate-200 p-2"
                onclick={() => menuOpen = !menuOpen}
                aria-label="Toggle menu"
                aria-expanded={menuOpen}
                aria-controls="mobile-menu"
            >
                <i class="fa-solid {menuOpen ? 'fa-xmark' : 'fa-bars'} text-xl"></i>
            </button>
            <div class="nav-links font-nabla hidden sm:flex absolute inset-y-0 right-0 items-center pr-2 sm:static sm:inset-auto sm:ml-6 sm:pr-0">
                <a class="text-lg font-semibold mr-6" href="/blog">Blog</a>
                <a class="text-lg font-semibold mr-6" href="/notes">Notes</a>
                <a class="text-lg font-semibold mr-6" href="/projects">Projects</a>
                <a class="text-lg" target="_blank" href="https://github.com/TAMUTim" aria-label="GitHub profile">
                    <i class="fa-brands fa-github"></i>
                </a>
            </div>
        </div>
        <div id="mobile-menu" class="mobile-menu nav-links font-nabla" class:open={menuOpen}>
            <div class="flex flex-col py-2">
                <a class="py-3 px-4 text-lg font-semibold" href="/blog">Blog</a>
                <a class="py-3 px-4 text-lg font-semibold" href="/notes">Notes</a>
                <a class="py-3 px-4 text-lg font-semibold" href="/projects">Projects</a>
                <a class="py-3 px-4 text-lg" target="_blank" href="https://github.com/TAMUTim" aria-label="GitHub profile">
                    <i class="fa-brands fa-github"></i> GitHub
                </a>
            </div>
        </div>
    </div>
</nav>

<main id="main-content">
    {@render children()}
</main>

<button
        title="Scroll to the top"
        aria-label="Scroll to top"
        class="fixed right-3 bottom-3 w-10 h-10 rounded-full z-100 print:hidden text-slate-200 {y > 10 ? 'opacity-100' : 'opacity-0'}"
        onclick={scrollToTop}
>
    <i class="fa-solid fa-arrow-up"></i>
</button>

{#key $page.url.pathname}
    <div class="flex flex-row items-center justify-center font-ibm">
        <div class="mt-10 mb-6 w-full max-w-[40rem] px-5 sm:px-0" style="--stagger: {animatedSections.count + 1}" data-animate>
            <span class="text-sm font-semibold text-slate-300">2024-Death CC Tim Cai</span>
            <div class="flex-auto"></div>
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

.mobile-menu {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 0.2s ease-out;
}

.mobile-menu > div {
    overflow: hidden;
}

.mobile-menu.open {
    grid-template-rows: 1fr;
    border-top: 1px solid var(--c-accent);
}

@media (min-width: 640px) {
    .mobile-menu {
        display: none;
    }
}
</style>