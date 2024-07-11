<svelte:head>
	<title>{title}</title>
</svelte:head>

<script>
	export let title = "Quote of the Day - Tim Cai";
</script>

<div class="flex flex-col">
	<div class="slider mt-[4rem]">
		<p class="text-slate-50 text-5xl font-nabla">Hello world!</p>
	</div>
</div>

<style>
	.slider {
			width: 100%;
			overflow: hidden;
			white-space: nowrap;
			box-sizing: border-box;
	}

	.slider p {
			display: inline-block;
			padding-left: 100%;
			animation: marquee 8s linear infinite;
	}

	@keyframes marquee {
			0%		{ transform: translate(0, 0); }
			100% 	{ transform: translate(-100%, 0); }
	}
</style>