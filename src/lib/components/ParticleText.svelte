<script lang="ts">
	import { browser } from '$app/environment';
	import {
		sampleTextPositions,
		createParticles,
		updateParticles,
		createRenderer,
		SAMPLE_STEP,
	} from './shaders/particleText';

	let canvas: HTMLCanvasElement = $state()!;
	let useWebGL = $state(false);

	// First effect: decide whether to use WebGL or fallback
	$effect(() => {
		if (!browser) return;
		if (window.innerWidth < 640 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			return;
		}
		useWebGL = true;
	});

	// Second effect: initialize WebGL when canvas is available
	$effect(() => {
		if (!useWebGL || !canvas) return;

		let cancelled = false;
		let animId: number;
		let cleanupFn: (() => void) | undefined;

		document.fonts.ready.then(() => {
			if (cancelled) return;

			const dpr = window.devicePixelRatio || 1;
			const parent = canvas.parentElement!;
			const { positions: homes, textHeight } = sampleTextPositions(
				'Tim Cai',
				'600 48px "Space Grotesk"',
				SAMPLE_STEP,
			);

			const topMargin = 4;
			let displayWidth = parent.clientWidth;
			const displayHeight = textHeight + topMargin * 2;

			// Size canvas: physical pixels for backing store, CSS pixels for display
			canvas.width = displayWidth * dpr;
			canvas.height = displayHeight * dpr;
			canvas.style.width = displayWidth + 'px';
			canvas.style.height = displayHeight + 'px';

			const gl = canvas.getContext('webgl2', {
				alpha: true,
				antialias: false,
				premultipliedAlpha: false,
			});
			if (!gl) return;

			gl.viewport(0, 0, canvas.width, canvas.height);

			const renderer = createRenderer(gl);
			const particles = createParticles(homes, displayWidth, displayHeight, topMargin);

			// Mouse tracking in canvas-local CSS pixels
			let mouseX = -1;
			let mouseY = -1;

			function onMouseMove(e: MouseEvent) {
				const rect = canvas.getBoundingClientRect();
				mouseX = e.clientX - rect.left;
				mouseY = e.clientY - rect.top;
			}

			function onMouseLeave() {
				mouseX = -1;
				mouseY = -1;
			}

			canvas.addEventListener('mousemove', onMouseMove);
			canvas.addEventListener('mouseleave', onMouseLeave);

			// Resize: update canvas dimensions, don't re-sample text
			function onResize() {
				displayWidth = parent.clientWidth;
				const currentDpr = window.devicePixelRatio || 1;
				canvas.width = displayWidth * currentDpr;
				canvas.height = displayHeight * currentDpr;
				canvas.style.width = displayWidth + 'px';
				canvas.style.height = displayHeight + 'px';
				gl!.viewport(0, 0, canvas.width, canvas.height);
			}

			window.addEventListener('resize', onResize);

			// Animation loop
			function frame() {
				updateParticles(particles, mouseX, mouseY);
				renderer.draw(
					particles.positions,
					particles.count,
					displayWidth,
					displayHeight,
					window.devicePixelRatio || 1,
				);
				animId = requestAnimationFrame(frame);
			}

			animId = requestAnimationFrame(frame);

			cleanupFn = () => {
				cancelAnimationFrame(animId);
				renderer.destroy();
				canvas.removeEventListener('mousemove', onMouseMove);
				canvas.removeEventListener('mouseleave', onMouseLeave);
				window.removeEventListener('resize', onResize);
			};
		});

		return () => {
			cancelled = true;
			cleanupFn?.();
		};
	});
</script>

<p
	class="text-3xl sm:text-5xl text-left font-semibold font-nabla text-slate-50"
	class:sr-only={useWebGL}
>
	Tim Cai
</p>

{#if useWebGL}
	<canvas bind:this={canvas}></canvas>
{/if}
