<script lang="ts">
	import animatedSections from '$lib/stores/animatedSections';

	animatedSections.set(2);
</script>

<div class="flex items-center justify-center mt-20">
	<div class="mt-10 w-hundred border-2 border-slate-50 min-h-[45rem]" style="--stagger: 1" data-animate>
		<slot />
	</div>
</div>
