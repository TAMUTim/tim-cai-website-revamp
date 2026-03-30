<script lang="ts">
	import { browser } from '$app/environment'
	import type { ShaderFactory, FrameUniforms } from './shaders/webgl'
	import { shaderBridge } from '$lib/stores/shaderBridge.svelte'

	interface Props {
		createShader: ShaderFactory
	}

	let { createShader }: Props = $props()

	let canvas: HTMLCanvasElement = $state()!
	let fallback = $state(false)

	$effect(() => {
		if (!browser || !canvas) return

		const isMobile = window.innerWidth < 640

		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || isMobile) {
			fallback = true
			return
		}

		const gl = canvas.getContext('webgl2', {
			alpha: false,
			antialias: false,
			premultipliedAlpha: false
		})

		if (!gl) {
			fallback = true
			return
		}

		const glCtx = gl
		const NAVBAR_HEIGHT = 48
		shaderBridge.gl = glCtx
		shaderBridge.canvasTop = NAVBAR_HEIGHT

		// Mouse tracking (desktop only, offset by navbar)
		let mouseX = -1
		let mouseY = -1

		function onMouseMove(e: MouseEvent) {
			mouseX = e.clientX
			mouseY = e.clientY - NAVBAR_HEIGHT
		}

		function onMouseLeave() {
			mouseX = -1
			mouseY = -1
		}

		window.addEventListener('mousemove', onMouseMove)
		window.addEventListener('mouseleave', onMouseLeave)

		// Canvas sizing (no DPR — ambient effect doesn't need retina resolution)
		let width = window.innerWidth
		let height = window.innerHeight - NAVBAR_HEIGHT

		function onResize() {
			width = window.innerWidth
			height = window.innerHeight - NAVBAR_HEIGHT
			canvas.width = width
			canvas.height = height
			glCtx.viewport(0, 0, width, height)
			shader.resize(width, height)
		}

		canvas.width = width
		canvas.height = height
		glCtx.viewport(0, 0, width, height)

		const shader = createShader(glCtx, width, height, isMobile)

		window.addEventListener('resize', onResize)

		// Render loop
		let animId: number
		let lastTime = performance.now()

		function frame(now: number) {
			const deltaTime = (now - lastTime) / 1000
			lastTime = now

			const uniforms: FrameUniforms = {
				time: now / 1000,
				deltaTime,
				resolution: [canvas.width, canvas.height],
				mouse: [mouseX, height - mouseY]
			}

			shader.draw(uniforms)
			shaderBridge.overlay?.draw(glCtx, uniforms)
			animId = requestAnimationFrame(frame)
		}

		animId = requestAnimationFrame(frame)

		return () => {
			shaderBridge.gl = null
			cancelAnimationFrame(animId)
			shader.destroy()
			window.removeEventListener('mousemove', onMouseMove)
			window.removeEventListener('mouseleave', onMouseLeave)
			window.removeEventListener('resize', onResize)
		}
	})
</script>

{#if fallback}
	<div class="shader-fallback"></div>
{:else}
	<canvas
		bind:this={canvas}
		class="fixed inset-x-0 bottom-0 pointer-events-none -z-10"
		style="top: 48px"
	></canvas>
{/if}

<style>
	.shader-fallback {
		position: fixed;
		inset: 0;
		pointer-events: none;
		z-index: -10;
		background: radial-gradient(ellipse at 20% 50%, rgba(255, 210, 20, 0.04) 0%, transparent 60%),
			radial-gradient(ellipse at 80% 30%, rgba(255, 155, 0, 0.03) 0%, transparent 60%);
	}
</style>
