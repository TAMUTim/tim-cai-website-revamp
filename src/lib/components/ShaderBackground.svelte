<script lang="ts">
	import { browser } from '$app/environment';
	import type { ShaderFactory, FrameUniforms } from './shaders/webgl';

	interface Props {
		createShader: ShaderFactory;
	}

	let { createShader }: Props = $props();

	let canvas: HTMLCanvasElement = $state()!;
	let fallback = $state(false);

	$effect(() => {
		if (!browser || !canvas) return;

		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			fallback = true;
			return;
		}

		const gl = canvas.getContext('webgl2', {
			alpha: false,
			antialias: false,
			premultipliedAlpha: false,
		});

		if (!gl) {
			fallback = true;
			return;
		}

		const glCtx = gl;
		const isMobile = window.innerWidth < 768;

		// Mouse tracking (desktop only)
		let mouseX = -1;
		let mouseY = -1;

		function onMouseMove(e: MouseEvent) {
			mouseX = e.clientX;
			mouseY = e.clientY;
		}

		function onMouseLeave() {
			mouseX = -1;
			mouseY = -1;
		}

		if (!isMobile) {
			window.addEventListener('mousemove', onMouseMove);
			window.addEventListener('mouseleave', onMouseLeave);
		}

		// Canvas sizing (no DPR — ambient effect doesn't need retina resolution)
		let width = window.innerWidth;
		let height = window.innerHeight;

		function onResize() {
			width = window.innerWidth;
			height = window.innerHeight;
			canvas.width = width;
			canvas.height = height;
			glCtx.viewport(0, 0, width, height);
			shader.resize(width, height);
		}

		canvas.width = width;
		canvas.height = height;
		glCtx.viewport(0, 0, width, height);

		const shader = createShader(glCtx, width, height, isMobile);

		window.addEventListener('resize', onResize);

		// Render loop
		let animId: number;
		let lastTime = performance.now();

		function frame(now: number) {
			const deltaTime = (now - lastTime) / 1000;
			lastTime = now;

			const uniforms: FrameUniforms = {
				time: now / 1000,
				deltaTime,
				resolution: [canvas.width, canvas.height],
				mouse: [mouseX, height - mouseY],
			};

			shader.draw(uniforms);
			animId = requestAnimationFrame(frame);
		}

		animId = requestAnimationFrame(frame);

		return () => {
			cancelAnimationFrame(animId);
			shader.destroy();
			if (!isMobile) {
				window.removeEventListener('mousemove', onMouseMove);
				window.removeEventListener('mouseleave', onMouseLeave);
			}
			window.removeEventListener('resize', onResize);
		};
	});
</script>

{#if fallback}
	<div class="shader-fallback"></div>
{:else}
	<canvas bind:this={canvas} class="fixed inset-0 w-full h-full pointer-events-none -z-10"></canvas>
{/if}

<style>
	.shader-fallback {
		position: fixed;
		inset: 0;
		pointer-events: none;
		z-index: -10;
		background:
			radial-gradient(ellipse at 20% 50%, rgba(255, 210, 20, 0.04) 0%, transparent 60%),
			radial-gradient(ellipse at 80% 30%, rgba(255, 155, 0, 0.03) 0%, transparent 60%);
	}
</style>
