<svelte:head>
    <title>{title}</title>
</svelte:head>

<script>
    export let title = "Error - Tim Cai"

    function goBack() {
        history.back();
    }
</script>

<div class="flex flex-col items-center justify-center font-ibm mt-10">
    <div class="w-1/4 prose" style="--stagger: 1" data-animate>
        <p class="text-3xl font-semibold text-slate-50">Error 404 or something...</p>
        <p class="mt-5 text-lg text-left text-slate-300">Hmm, that's a little strange, how did you end up here?</p>
        <p class="mt-5 text-lg text-left text-slate-300">Anyhow, here's the <button on:click={goBack}>way back</button> if you didn't mean to be here. Thanks for visiting!</p>
    </div>
</div>

<style>
    .prose button {
        color: rgb(248 250 252);
        text-decoration: none;
        border-bottom: 1px solid #94a3b8;
        transition: border 0.2s ease-in-out;
    }

    .prose button:hover {
        border-bottom: 1px solid rgb(248 250 252);
    }
</style>