# Particle Text on Shared Canvas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move particle text rendering onto the existing flow field canvas, eliminating the second WebGL context. A Svelte store bridges ShaderBackground (layout) and ParticleText (home page).

**Architecture:** A reactive store (`shaderBridge`) lets ShaderBackground publish its GL context and ParticleText register a draw callback. ShaderBackground's animation loop calls the overlay after the flow field renders. ParticleText places a placeholder `<div>` in the page flow and uses `getBoundingClientRect()` each frame to map particle positions onto the full-screen canvas.

**Tech Stack:** SvelteKit, Svelte 5, WebGL2, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-29-particle-text-shared-canvas-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/stores/shaderBridge.svelte.ts` | Create | Reactive store bridging ShaderBackground ↔ ParticleText |
| `src/lib/components/ShaderBackground.svelte` | Modify | Publish GL context, call overlay in animation loop |
| `src/lib/components/shaders/particleText.ts` | Modify | Remove `topMargin`, add offset params, remove `gl.clear` |
| `src/lib/components/ParticleText.svelte` | Rewrite | Use shared GL via bridge, placeholder div, no own canvas |

`flowField.ts`, `webgl.ts`, and `+page.svelte` are **not modified**.

---

### Task 1: Create shaderBridge store

**Files:**
- Create: `src/lib/stores/shaderBridge.svelte.ts`

A minimal reactive store following the same `$state` pattern as the existing `animatedSections.svelte.ts`. Provides two pieces of state: the GL context (published by ShaderBackground) and an overlay (published by ParticleText).

- [ ] **Step 1: Create `src/lib/stores/shaderBridge.svelte.ts`**

```typescript
import type { FrameUniforms } from '$lib/components/shaders/webgl';

export interface ShaderOverlay {
	draw(gl: WebGL2RenderingContext, uniforms: FrameUniforms): void;
	destroy(): void;
}

let glContext = $state<WebGL2RenderingContext | null>(null);
let currentOverlay = $state<ShaderOverlay | null>(null);

export const shaderBridge = {
	get gl() { return glContext; },
	set gl(v: WebGL2RenderingContext | null) { glContext = v; },
	get overlay() { return currentOverlay; },
	set overlay(v: ShaderOverlay | null) { currentOverlay = v; },
};
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/stores/shaderBridge.svelte.ts
git commit -m "feat: add shaderBridge store for GL context and overlay sharing"
```

---

### Task 2: Update ShaderBackground to support overlays

**Files:**
- Modify: `src/lib/components/ShaderBackground.svelte`

Three surgical additions: import the bridge, publish the GL context after creation, and call the overlay in the animation loop. No other changes — mouse tracking, resize, canvas setup all stay identical.

- [ ] **Step 1: Add the shaderBridge import**

Add this import at the top of the `<script>` block, after the existing imports:

```typescript
import { shaderBridge } from '$lib/stores/shaderBridge.svelte';
```

- [ ] **Step 2: Publish GL context to bridge**

Inside the `$effect`, after the line `const glCtx = gl;` (line 35), add:

```typescript
shaderBridge.gl = glCtx;
```

- [ ] **Step 3: Call overlay in animation loop**

Inside the `frame` function, after `shader.draw(uniforms);` and before `animId = requestAnimationFrame(frame);`, add:

```typescript
shaderBridge.overlay?.draw(glCtx, uniforms);
```

- [ ] **Step 4: Clear bridge on cleanup**

Inside the cleanup return function, before `cancelAnimationFrame(animId);`, add:

```typescript
shaderBridge.gl = null;
```

- [ ] **Step 5: Verify the full effect block looks correct**

The modified `$effect` should now look like this (showing only the changed/new lines with context):

```typescript
$effect(() => {
    if (!browser || !canvas) return;

    // ... mobile/reduced-motion checks (unchanged) ...

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
    shaderBridge.gl = glCtx;  // NEW

    // ... mouse tracking (unchanged) ...
    // ... canvas sizing (unchanged) ...
    // ... shader creation (unchanged) ...
    // ... resize handler (unchanged) ...

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
        shaderBridge.overlay?.draw(glCtx, uniforms);  // NEW
        animId = requestAnimationFrame(frame);
    }

    animId = requestAnimationFrame(frame);

    return () => {
        shaderBridge.gl = null;  // NEW
        cancelAnimationFrame(animId);
        shader.destroy();
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseleave', onMouseLeave);
        window.removeEventListener('resize', onResize);
    };
});
```

- [ ] **Step 6: Verify typecheck passes**

Run: `npm run check`
Expected: No errors. The overlay is always null at this point, so the `?.` call is a no-op. No visual change.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/ShaderBackground.svelte
git commit -m "feat: add overlay support to ShaderBackground via shaderBridge"
```

---

### Task 3: Migrate ParticleText to shared canvas

**Files:**
- Modify: `src/lib/components/shaders/particleText.ts`
- Rewrite: `src/lib/components/ParticleText.svelte`

This task makes three changes to the engine and fully rewrites the component. They must be done together because the engine's function signatures change and the component is the only call site.

#### Part A: Update particleText.ts

- [ ] **Step 1: Update `createParticles` — remove `topMargin` parameter**

Replace the current `createParticles` function (lines 77-106) with:

```typescript
export function createParticles(
	homes: Array<{ x: number; y: number }>,
	scatterWidth: number,
	scatterHeight: number,
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
		sys.homeY[i] = homes[i].y;
		// Start at random positions for entrance formation animation
		sys.x[i] = Math.random() * scatterWidth;
		sys.y[i] = Math.random() * scatterHeight;
		sys.vx[i] = 0;
		sys.vy[i] = 0;
	}

	return sys;
}
```

Changes from the original:
- Removed `topMargin` parameter
- `homeY` stores raw sampled position (no `+ topMargin`)
- Parameters renamed: `canvasWidth/canvasHeight` → `scatterWidth/scatterHeight` (now viewport dimensions)

- [ ] **Step 2: Update `updateParticles` — add offset parameters**

Replace the current `updateParticles` function (lines 108-142) with:

```typescript
export function updateParticles(
	sys: ParticleSystem,
	mouseX: number,
	mouseY: number,
	offsetX: number,
	offsetY: number,
): void {
	for (let i = 0; i < sys.count; i++) {
		// Spring force toward home (offset by placeholder position)
		sys.vx[i] += (sys.homeX[i] + offsetX - sys.x[i]) * SPRING_K;
		sys.vy[i] += (sys.homeY[i] + offsetY - sys.y[i]) * SPRING_K;

		// Damping
		sys.vx[i] *= DAMPING;
		sys.vy[i] *= DAMPING;

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

		// Integrate position
		sys.x[i] += sys.vx[i];
		sys.y[i] += sys.vy[i];

		// Write to interleaved buffer for GPU upload
		sys.positions[i * 2] = sys.x[i];
		sys.positions[i * 2 + 1] = sys.y[i];
	}
}
```

Changes from the original:
- Added `offsetX: number, offsetY: number` parameters
- Spring force uses `sys.homeX[i] + offsetX` and `sys.homeY[i] + offsetY` instead of raw home positions

- [ ] **Step 3: Remove `gl.clear` from `createRenderer.draw`**

In the `draw` method of `createRenderer` (around lines 215-218), remove the two clear lines:

```typescript
// REMOVE these two lines:
gl.clearColor(0, 0, 0, 0);
gl.clear(gl.COLOR_BUFFER_BIT);
```

The draw method should now start with:

```typescript
draw(positions, count, logicalWidth, logicalHeight, dpr) {
    gl.viewport(0, 0, logicalWidth * dpr, logicalHeight * dpr);

    gl.useProgram(program);
    // ... rest unchanged ...
```

This prevents the overlay from erasing the flow field output that was just rendered.

#### Part B: Rewrite ParticleText.svelte

- [ ] **Step 4: Replace the entire contents of `src/lib/components/ParticleText.svelte`**

```svelte
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
```

**What changed from the old component:**
- Removed: own `<canvas>`, own WebGL context, own `requestAnimationFrame` loop, own mouse listeners, own resize handler, DPR handling, `console.log`
- Added: `shaderBridge` import, reads `shaderBridge.gl` reactively, registers overlay draw callback
- Placeholder `<div>` with invisible text replaces the old `<canvas>`
- The draw callback uses `getBoundingClientRect()` on the placeholder for viewport-relative positioning
- Mouse coordinates are derived from `uniforms.mouse` (un-flipping Y) instead of own event listeners
- Particles scatter across viewport dimensions (`window.innerWidth/Height`) for entrance animation

#### Part C: Verify and commit

- [ ] **Step 5: Verify typecheck passes**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 6: Visual verification**

Run: `npm run dev`

Open `http://localhost:5173` in a desktop browser and verify:
1. Dots converge from across the viewport to form "Tim Cai" on the background canvas
2. Flow field particles render normally behind/around the text
3. Mouse hover causes text particles to ripple outward and spring back
4. Flow field particles near the cursor also scatter (unified mouse interaction)
5. Scroll down — text particles move with the page content
6. Scroll the heading off-screen — particles follow and disappear
7. Navigate to /blog — particles disappear cleanly, flow field continues
8. Navigate back to / — particles reform (fresh entrance animation)
9. No second canvas element in the DOM (inspect with DevTools)
10. No console errors

Mobile verification (DevTools responsive mode at 375px):
1. Regular "Tim Cai" heading shows as static text
2. No WebGL canvas or particle rendering

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/shaders/particleText.ts src/lib/components/ParticleText.svelte
git commit -m "feat: migrate particle text to shared flow field canvas"
```
