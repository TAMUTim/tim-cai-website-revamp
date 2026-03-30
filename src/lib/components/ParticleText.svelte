<script lang="ts">
	import { browser } from '$app/environment';
	import { shaderBridge } from '$lib/stores/shaderBridge.svelte';
	import {
		sampleTextPositions,
		createParticles,
		updateParticles,
		createRenderer,
		SAMPLE_STEP,
	} from './shaders/particleText';

	let placeholder: HTMLDivElement = $state()!;
	let useWebGL = $state(false);

	// First effect: decide whether to use WebGL or fallback
	$effect(() => {
		if (!browser) return;
		if (window.innerWidth < 640 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			return;
		}
		useWebGL = true;
	});

	// Second effect: initialize on shared GL context when available
	$effect(() => {
		if (!useWebGL || !placeholder) return;
		const gl = shaderBridge.gl;
		if (!gl) return;

		let cancelled = false;

		document.fonts.ready.then(() => {
			if (cancelled) return;

			const { positions: homes } = sampleTextPositions(
				'Tim Cai',
				'600 64px "Space Grotesk"',
				SAMPLE_STEP,
			);

			const renderer = createRenderer(gl);
			const particles = createParticles(homes, window.innerWidth, window.innerHeight);

			shaderBridge.overlay = {
				draw(_gl, uniforms) {
					const rect = placeholder.getBoundingClientRect();

					// Un-flip mouse Y from flow field convention
					const mouseX = uniforms.mouse[0];
					const mouseY = uniforms.resolution[1] - uniforms.mouse[1];

					updateParticles(particles, mouseX, mouseY, rect.left, rect.top);
					renderer.draw(
						particles.positions,
						particles.count,
						uniforms.resolution[0],
						uniforms.resolution[1],
						1,
					);
				},
				destroy() {
					renderer.destroy();
				},
			};
		});

		return () => {
			cancelled = true;
			if (shaderBridge.overlay) {
				shaderBridge.overlay.destroy();
				shaderBridge.overlay = null;
			}
		};
	});
</script>

{#if useWebGL}
	<div bind:this={placeholder}>
		<p class="text-[64px] font-semibold font-nabla text-transparent select-none" aria-hidden="true">Tim Cai</p>
		<p class="sr-only">Tim Cai</p>
	</div>
{:else}
	<p class="text-3xl font-semibold font-nabla text-slate-50">Tim Cai</p>
{/if}
