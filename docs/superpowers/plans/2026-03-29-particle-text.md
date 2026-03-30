# Particle Text Heading — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Tim Cai" heading on the home page with an interactive WebGL2 particle text effect — dots that form the text, ripple outward on mouse hover, and spring back.

**Architecture:** Offscreen Canvas 2D samples text pixel positions, CPU spring physics updates ~1000 particles per frame, minimal WebGL2 renderer draws point sprites. Svelte component handles lifecycle, mouse events, DPR scaling, and mobile fallback.

**Tech Stack:** SvelteKit, Svelte 5, WebGL2, Canvas 2D (text sampling), TypeScript

**Spec:** `docs/superpowers/specs/2026-03-29-particle-text-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/components/shaders/particleText.ts` | Create | Text sampling, particle physics, WebGL shaders & renderer |
| `src/lib/components/ParticleText.svelte` | Create | Svelte component: canvas lifecycle, mouse events, DPR, mobile fallback |
| `src/routes/+page.svelte` | Modify | Replace heading with `<ParticleText />`, separate from `data-animate` container |

---

### Task 1: Create particle text engine

**Files:**
- Create: `src/lib/components/shaders/particleText.ts`

This file contains all the logic: text sampling from an offscreen canvas, particle system with spring physics, and a minimal WebGL2 point sprite renderer. It follows the same pattern as `flowField.ts` (lives in `shaders/`, imports from `./webgl`), but is simpler — CPU physics instead of transform feedback, no FBOs, no trails.

- [ ] **Step 1: Create `src/lib/components/shaders/particleText.ts`**

```typescript
import { compileShader, createProgram } from './webgl';

// --- Tunable Constants ---

export const SAMPLE_STEP = 3;
export const SPRING_K = 0.08;
export const DAMPING = 0.85;
export const MOUSE_RADIUS = 80;
export const MOUSE_STRENGTH = 8;
export const POINT_SIZE = 2.0;

// --- Text Sampling ---
// Renders text to an offscreen Canvas 2D, reads back pixel data,
// and returns positions where the text was filled.

export interface SampleResult {
	positions: Array<{ x: number; y: number }>;
	textWidth: number;
	textHeight: number;
}

export function sampleTextPositions(
	text: string,
	font: string,
	step: number,
): SampleResult {
	const offscreen = document.createElement('canvas');
	const ctx = offscreen.getContext('2d')!;

	ctx.font = font;
	const metrics = ctx.measureText(text);

	const textWidth = Math.ceil(metrics.width);
	const ascent = Math.ceil(metrics.actualBoundingBoxAscent);
	const descent = Math.ceil(metrics.actualBoundingBoxDescent);
	const textHeight = ascent + descent;

	offscreen.width = textWidth;
	offscreen.height = textHeight;

	// Must re-set font after canvas resize (resets context state)
	ctx.font = font;
	ctx.fillStyle = 'white';
	ctx.fillText(text, 0, ascent);

	const imageData = ctx.getImageData(0, 0, textWidth, textHeight);
	const pixels = imageData.data;

	const positions: Array<{ x: number; y: number }> = [];
	for (let y = 0; y < textHeight; y += step) {
		for (let x = 0; x < textWidth; x += step) {
			const i = (y * textWidth + x) * 4;
			if (pixels[i + 3] > 128) {
				positions.push({ x, y });
			}
		}
	}

	return { positions, textWidth, textHeight };
}

// --- Particle System ---
// CPU-side spring physics. Each particle has a home position (from text sampling)
// and a current position that springs toward home and gets pushed by the mouse.

export interface ParticleSystem {
	count: number;
	homeX: Float32Array;
	homeY: Float32Array;
	x: Float32Array;
	y: Float32Array;
	vx: Float32Array;
	vy: Float32Array;
	positions: Float32Array; // interleaved [x, y, x, y, ...] for GPU upload
}

export function createParticles(
	homes: Array<{ x: number; y: number }>,
	canvasWidth: number,
	canvasHeight: number,
	topMargin: number,
): ParticleSystem {
	const count = homes.length;
	const sys: ParticleSystem = {
		count,
		homeX: new Float32Array(count),
		homeY: new Float32Array(count),
		x: new Float32Array(count),
		y: new Float32Array(count),
		vx: new Float32Array(count),
		vy: new Float32Array(count),
		positions: new Float32Array(count * 2),
	};

	for (let i = 0; i < count; i++) {
		sys.homeX[i] = homes[i].x;
		sys.homeY[i] = homes[i].y + topMargin;
		// Start at random positions for entrance formation animation
		sys.x[i] = Math.random() * canvasWidth;
		sys.y[i] = Math.random() * canvasHeight;
		sys.vx[i] = 0;
		sys.vy[i] = 0;
	}

	return sys;
}

export function updateParticles(
	sys: ParticleSystem,
	mouseX: number,
	mouseY: number,
): void {
	for (let i = 0; i < sys.count; i++) {
		// Spring force toward home
		sys.vx[i] += (sys.homeX[i] - sys.x[i]) * SPRING_K;
		sys.vy[i] += (sys.homeY[i] - sys.y[i]) * SPRING_K;

		// Mouse repulsion (mouseX < 0 means inactive)
		if (mouseX >= 0) {
			const dx = sys.x[i] - mouseX;
			const dy = sys.y[i] - mouseY;
			const dist = Math.sqrt(dx * dx + dy * dy);
			if (dist < MOUSE_RADIUS && dist > 0.1) {
				const strength = (1 - dist / MOUSE_RADIUS) * MOUSE_STRENGTH;
				sys.vx[i] += (dx / dist) * strength;
				sys.vy[i] += (dy / dist) * strength;
			}
		}

		// Damping
		sys.vx[i] *= DAMPING;
		sys.vy[i] *= DAMPING;

		// Integrate position
		sys.x[i] += sys.vx[i];
		sys.y[i] += sys.vy[i];

		// Write to interleaved buffer for GPU upload
		sys.positions[i * 2] = sys.x[i];
		sys.positions[i * 2 + 1] = sys.y[i];
	}
}

// --- WebGL Shaders ---
// Minimal point sprite renderer. Vertex shader converts CSS-pixel positions
// to clip space. Fragment shader draws soft circles.

const VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_position;

uniform vec2 u_resolution;
uniform float u_pointSize;

void main() {
	vec2 clip = (a_position / u_resolution) * 2.0 - 1.0;
	clip.y = -clip.y;
	gl_Position = vec4(clip, 0.0, 1.0);
	gl_PointSize = u_pointSize;
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

out vec4 fragColor;

void main() {
	float dist = length(gl_PointCoord - 0.5);
	if (dist > 0.5) discard;

	float alpha = (1.0 - dist * 2.0) * 0.8;
	vec3 color = vec3(0.88, 0.88, 0.92);
	fragColor = vec4(color, alpha);
}
`;

// --- Renderer ---
// Creates a WebGL2 program and buffer, provides draw() and destroy() methods.
// Uses compileShader/createProgram from ./webgl (same helpers as flowField.ts).

export interface ParticleRenderer {
	draw(
		positions: Float32Array,
		count: number,
		logicalWidth: number,
		logicalHeight: number,
		dpr: number,
	): void;
	destroy(): void;
}

export function createRenderer(gl: WebGL2RenderingContext): ParticleRenderer {
	const program = createProgram(
		gl,
		compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER),
		compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER),
	);

	const uResolution = gl.getUniformLocation(program, 'u_resolution');
	const uPointSize = gl.getUniformLocation(program, 'u_pointSize');

	const positionBuffer = gl.createBuffer()!;
	const vao = gl.createVertexArray()!;

	gl.bindVertexArray(vao);
	gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
	const posLoc = gl.getAttribLocation(program, 'a_position');
	gl.enableVertexAttribArray(posLoc);
	gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
	gl.bindVertexArray(null);

	return {
		draw(positions, count, logicalWidth, logicalHeight, dpr) {
			gl.viewport(0, 0, logicalWidth * dpr, logicalHeight * dpr);
			gl.clearColor(0, 0, 0, 0);
			gl.clear(gl.COLOR_BUFFER_BIT);

			gl.useProgram(program);
			gl.uniform2f(uResolution, logicalWidth, logicalHeight);
			gl.uniform1f(uPointSize, POINT_SIZE * dpr);

			gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);

			gl.enable(gl.BLEND);
			gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

			gl.bindVertexArray(vao);
			gl.drawArrays(gl.POINTS, 0, count);
			gl.bindVertexArray(null);
		},

		destroy() {
			gl.deleteProgram(program);
			gl.deleteBuffer(positionBuffer);
			gl.deleteVertexArray(vao);
		},
	};
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run check`
Expected: No errors. The file only imports from `./webgl` (which exists) and uses standard Web APIs.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/shaders/particleText.ts
git commit -m "feat: add particle text engine (sampling, physics, WebGL renderer)"
```

---

### Task 2: Create ParticleText Svelte component

**Files:**
- Create: `src/lib/components/ParticleText.svelte`

This component handles the canvas lifecycle, DPR scaling, mouse events, font loading, and mobile fallback. It uses the engine from Task 1.

**Key patterns (matching `ShaderBackground.svelte`):**
- `$effect` for WebGL lifecycle with cleanup return
- `document.fonts.ready` for font loading (async inside sync effect, with cancellation flag)
- Mobile detection: `window.innerWidth < 640` + `prefers-reduced-motion`
- Cleanup: cancel RAF, destroy GL resources, remove event listeners

- [ ] **Step 1: Create `src/lib/components/ParticleText.svelte`**

```svelte
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
				gl.viewport(0, 0, canvas.width, canvas.height);
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
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run check`
Expected: No errors. Imports from `./shaders/particleText` (Task 1) and `$app/environment` (SvelteKit).

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/ParticleText.svelte
git commit -m "feat: add ParticleText component with WebGL canvas and mobile fallback"
```

---

### Task 3: Integrate into home page

**Files:**
- Modify: `src/routes/+page.svelte`

Replace the `<p>` heading with `<ParticleText />`. Per the spec (Section 6), the particle text must be in its own container **without** `data-animate` so the formation animation plays at full opacity. The intro paragraphs move to a separate `data-animate` container.

- [ ] **Step 1: Update `src/routes/+page.svelte`**

Replace the full file content with:

```svelte
<script>
	import { animatedSections } from '$lib/stores/animatedSections.svelte'
	import ParticleText from '$lib/components/ParticleText.svelte'

	let title = 'Tim Cai'

	animatedSections.set(3)
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

<div class="flex flex-col items-center justify-center font-ibm mt-6 sm:mt-10">
	<div class="w-full max-w-[40rem] px-5 sm:px-0">
		<ParticleText />
	</div>
	<div class="w-full max-w-[40rem] px-5 sm:px-0" style="--stagger: 1" data-animate>
		<p class="mt-5 text-lg text-left text-slate-300">Howdy! My name is Tim Cai, how are you?</p>
		<p class="mt-5 text-lg text-left text-slate-300">
			I'm a software engineer at Roblox, currently working on cool problems in Geometry!
		</p>
		<p class="mt-5 text-lg text-left text-slate-300">
			Check out my thoughts <a href="/blog">here</a>, and my work <a href="/work">here</a>.
		</p>
	</div>
	<div class="w-full max-w-[40rem] px-5 sm:px-0" style="--stagger: 2" data-animate>
		<hr class="mt-8 mb-8 rounded bg-slate-400 w-14 border-0 h-0.5" />

		<p class="text-lg text-left text-slate-300">Find me on</p>

		<div class="text-lg text-left text-slate-300 my-4">
			<a target="_blank" href="https://github.com/TAMUTim"
				><i class="fa-brands fa-github"></i> Github</a
			>
			<a class="ml-2" target="_blank" href="https://www.linkedin.com/in/tim-cai/"
				><i class="fa-brands fa-linkedin"></i> LinkedIn</a
			>
		</div>

		<p class="text-lg text-left text-slate-300">
			or email me directly at <a href="mailto:timcai.tyc@gmail.com">timcai.tyc@gmail.com</a>
		</p>
	</div>
	<div class="w-full max-w-[40rem] px-5 sm:px-0" style="--stagger: 2" data-animate>
		<hr class="mt-8 mb-8 rounded bg-slate-400 w-14 border-0 h-0.5" />

		<p class="text-lg text-left text-slate-300">
			I'm always open to new opportunities, if you'd like to say hi, let me know!
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
```

**Changes from the original:**
- Added `import ParticleText from '$lib/components/ParticleText.svelte'`
- Heading `<p>` replaced with `<ParticleText />` in its own container (no `data-animate`)
- First `data-animate` section now starts at the intro paragraph (heading removed from it)
- Everything else unchanged

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 3: Visual verification**

Run: `npm run dev`

Open `http://localhost:5173` in a desktop browser and verify:
1. Dots converge from random positions to form "Tim Cai" (~1-2 seconds)
2. Text is readable as dots — clear letter shapes
3. Moving mouse over the text causes dots to ripple outward
4. Moving mouse away causes dots to spring back to text positions
5. Intro paragraphs below fade in via `data-animate` stagger
6. Flow field background renders normally behind/around the heading
7. No horizontal scrollbar or layout shift
8. Resize the browser — canvas resizes, dots stay positioned correctly

Mobile verification (use browser DevTools responsive mode at 375px width):
1. Regular HTML "Tim Cai" heading shows (no canvas, no WebGL)
2. Text styled correctly (`text-3xl font-semibold font-nabla text-slate-50`)

- [ ] **Step 4: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: integrate particle text heading on home page"
```
