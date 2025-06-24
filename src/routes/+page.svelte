<svelte:head>
    <title>{title}</title>
</svelte:head>

<script>
    import animatedSections from '$lib/stores/animatedSections';

    export let title = "Tim Cai";

    animatedSections.set(3);
</script>

<div class="flex flex-col items-center justify-center font-ibm mt-10">
    <div class="w-content" style="--stagger: 1" data-animate>
            <p class="text-5xl text-left font-semibold font-nabla text-slate-50">Tim Cai</p>
            <p class="mt-5 text-lg text-left text-slate-300">Howdy! My name is Timothy Cai, how are you?</p>
            <p class="mt-5 text-lg text-left text-slate-300">I'm a computer science guy, and creating stuff is my passion!</p>
            <p class="mt-5 text-lg text-left text-slate-300">
                Check out my writing <a href="/blog">here</a>, and my work <a href="/work">here</a>.
            </p>

            <p class="mt-5 text-lg text-left text-slate-300">
                Independent of programming, I like getting on the Rift, reading, and food.
                Recently, I've been on a sci-fi tear - Hyperion is incredible!
            </p>

            <p class="mt-5 text-lg text-left text-slate-300">
                I'm also doing a cool thing <a href="/project-summer">here</a>, over the course of 100 days.
            </p>
    </div>
    <div class="w-content" style="--stagger: 2" data-animate>
        <hr class="mt-8 mb-8 rounded bg-slate-400 w-14 border-0 h-0.5">

        <p class="text-lg text-left text-slate-300">Find me on</p>

        <div class="text-lg text-left text-slate-300 my-4">
            <a target="_blank" href="https://github.com/TAMUTim"><i class="fa-brands fa-github"></i> Github</a>
            <a class="ml-2" target="_blank" href="https://www.linkedin.com/in/tim-cai/"><i class="fa-brands fa-linkedin"></i> LinkedIn</a>
        </div>

        <p class="text-lg text-left text-slate-300">or email me directly at <a href="mailto:timcai.tyc@gmail.com">timcai.tyc@gmail.com</a></p>
    </div>
    <div class="w-content" style="--stagger: 2" data-animate>
        <hr class="mt-8 mb-8 rounded bg-slate-400 w-14 border-0 h-0.5">

        <p class="text-lg text-left text-slate-300">
            I am always open to new opportunities, if you'd like to say hi, let me know!
        </p>
    </div>
</div>

<style>
    a {
        color: var(--c-slate-50);
        text-decoration: none;
        border-bottom: 1px solid var(--c-slate-400);
        transition: border 0.2s ease-in-out;
    }

    a:hover {
        border-bottom: 1px solid var(--c-slate-50);
    }
</style>