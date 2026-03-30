# Particle Text on Shared Canvas — Design Spec

## Goal

Move the particle text rendering from its own WebGL2 canvas into the existing full-screen flow field canvas. The text particles render as a second draw call on the same GL context, eliminating the second WebGL context. A Svelte store bridges ShaderBackground (layout) and ParticleText (home page) so the overlay can register/unregister as the user navigates.

## Constraints

- No new dependencies
- Flow field shader (`flowField.ts`) is NOT modified
- The `ShaderInstance` / `ShaderFactory` / `FrameUniforms` interfaces in `webgl.ts` are NOT modified
- Mobile fallback unchanged: show static `<p>` heading
- Must handle scroll (heading moves with page, canvas is fixed)
- Must handle navigation (overlay appears on home page only, cleans up on navigate away)

---

## 1. Shader Bridge Store

**New file:** `src/lib/stores/shaderBridge.svelte.ts`

A minimal reactive store that allows ShaderBackground (in layout) and ParticleText (in home page) to communicate. Follows the same `$state` pattern as the existing `animatedSections.svelte.ts`.

**Interface:**

```typescript
import type { FrameUniforms } from '$lib/components/shaders/webgl';

export interface ShaderOverlay {
    draw(gl: WebGL2RenderingContext, uniforms: FrameUniforms): void;
    destroy(): void;
}
```

**Store state:**
- `gl: WebGL2RenderingContext | null` — published by ShaderBackground after creating the GL context, cleared on cleanup
- `overlay: ShaderOverlay | null` — published by ParticleText on mount, cleared on unmount

**Flow:**
1. ShaderBackground creates GL context → sets `shaderBridge.gl`
2. ParticleText mounts, reads `shaderBridge.gl`, creates its renderer on the shared context
3. ParticleText sets `shaderBridge.overlay` with a draw callback
4. ShaderBackground's animation loop: after `shader.draw(uniforms)`, checks `shaderBridge.overlay` and calls `overlay.draw(gl, uniforms)` if present
5. ParticleText unmounts → calls `overlay.destroy()`, sets `shaderBridge.overlay = null`
6. ShaderBackground unmounts → sets `shaderBridge.gl = null`

## 2. ShaderBackground Changes

**File:** `src/lib/components/ShaderBackground.svelte`

Two additions to the existing `$effect`:

**a) Publish GL context to bridge:**
After `const gl = canvas.getContext('webgl2', ...)` succeeds, set `shaderBridge.gl = glCtx`. In the cleanup return, set `shaderBridge.gl = null`.

**b) Call overlay in animation loop:**
After `shader.draw(uniforms)`, check the bridge for an overlay and call it:

```typescript
function frame(now: number) {
    // ... existing uniform setup ...
    shader.draw(uniforms);

    // Draw overlay if registered (e.g., particle text on home page)
    shaderBridge.overlay?.draw(glCtx, uniforms);

    animId = requestAnimationFrame(frame);
}
```

The overlay's draw call happens after the flow field renders (including its trail compositing), so text particles appear on top of the flow field. The flow field's final step blits the trail FBO to the screen with blending disabled. The overlay is responsible for setting its own GL state — it must call `gl.enable(gl.BLEND)` and `gl.blendFunc(gl.SRC_ALPHA, gl.ONE)` before drawing, since the flow field leaves blending disabled. The current `createRenderer.draw` already does this.

**No other changes to ShaderBackground.** The mouse tracking, resize handling, and canvas setup remain identical.

## 3. ParticleText Changes

**File:** `src/lib/components/ParticleText.svelte`

Major refactor — the component no longer creates its own canvas or GL context.

**What it does now:**
1. Checks mobile/reduced-motion → falls back to static `<p>` (unchanged)
2. Renders a **placeholder `<div>`** where the heading sits, with an invisible text element to occupy the correct layout height
3. Reads `shaderBridge.gl` reactively — when the GL context becomes available, creates its renderer and particle system on the shared context
4. Registers an overlay draw callback via `shaderBridge.overlay`
5. The draw callback reads the placeholder's viewport position each frame via `getBoundingClientRect()` and passes it as an offset to the particle physics

**Template (desktop):**

```html
<div bind:this={placeholder}>
    <p class="text-[64px] font-semibold font-nabla text-transparent select-none" aria-hidden="true">Tim Cai</p>
    <p class="sr-only">Tim Cai</p>
</div>
```

The invisible `<p>` (text-transparent) occupies the heading's layout height. Note: Tailwind's `text-[64px]` sets `line-height: 1` (64px), but the font's actual bounding box (ascent + descent) is likely ~48-50px for 64px Space Grotesk. The placeholder will be ~14px taller than the particle text area. This is fine — the particles render at the correct viewport position via `getBoundingClientRect()`, and the extra line-height acts as natural spacing between the heading and content below. If tighter spacing is needed, add `leading-none` or an explicit `style="line-height: 0.8"` to the invisible `<p>`.

The sr-only `<p>` provides accessibility. No canvas element — particles render on the background canvas.

**Template (mobile fallback):**

```html
<p class="text-3xl font-semibold font-nabla text-slate-50">Tim Cai</p>
```

Unchanged from current behavior.

**Overlay draw callback:**

```typescript
shaderBridge.overlay = {
    draw(gl, uniforms) {
        const rect = placeholder.getBoundingClientRect();
        const offsetX = rect.left;
        const offsetY = rect.top;

        // Un-flip mouse Y from flow field convention
        const mouseX = uniforms.mouse[0];
        const mouseY = uniforms.resolution[1] - uniforms.mouse[1];

        updateParticles(particles, mouseX, mouseY, offsetX, offsetY);
        renderer.draw(
            particles.positions, particles.count,
            uniforms.resolution[0], uniforms.resolution[1], 1
        );
    },
    destroy() {
        renderer.destroy();
    }
};
```

`topMargin` is no longer needed. In the old standalone canvas, it prevented dots at the text edges from clipping against the canvas boundary. On the full-screen canvas, there is no boundary — dots can fly anywhere. The offset is simply the placeholder's viewport position.

**Font loading:** Still uses `document.fonts.ready.then(...)` with the cancellation flag pattern, same as before.

**No own animation loop.** The background shader's loop drives the overlay draw.

## 4. particleText.ts Changes

**File:** `src/lib/components/shaders/particleText.ts`

Minimal changes to support viewport-relative coordinates:

**a) `createParticles` — remove `topMargin` parameter:**

The offset is now applied at draw time, not baked into home positions.

```typescript
export function createParticles(
    homes: Array<{ x: number; y: number }>,
    scatterWidth: number,
    scatterHeight: number,
): ParticleSystem
```

- `homeX[i] = homes[i].x` (raw sampled position, no offset)
- `homeY[i] = homes[i].y` (raw sampled position, no offset)
- `x[i] = Math.random() * scatterWidth` (scatter across viewport width)
- `y[i] = Math.random() * scatterHeight` (scatter across viewport height)

The entrance animation now scatters particles across the entire viewport and they converge from all directions toward the heading. The spring force is proportional to displacement, so convergence time is roughly constant regardless of starting distance (~1-2 seconds).

**b) `updateParticles` — add offset parameters:**

```typescript
export function updateParticles(
    sys: ParticleSystem,
    mouseX: number,
    mouseY: number,
    offsetX: number,
    offsetY: number,
): void
```

Inside the loop, the effective home position is `homeX[i] + offsetX`, `homeY[i] + offsetY`. This accounts for the heading's current viewport position (which changes on scroll).

**c) `createRenderer.draw` — remove the clear call:**

The renderer's `draw` function currently calls `gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);` at the start of each frame. This was correct for the standalone canvas (clear to transparent before drawing). In overlay mode, this would erase the flow field output that was just rendered. Remove both lines — the overlay draws additively on top of whatever is already on the screen framebuffer.

**d) No other changes.** `sampleTextPositions`, shaders, and constants stay the same. The renderer's `draw` function receives viewport dimensions as resolution and `dpr = 1` (matching the background canvas's non-DPR-scaled setup).

## 5. Coordinate System

All particle positions are in **CSS pixels, viewport origin (top-left)**, matching the background canvas's coordinate space.

**Canvas:** `position: fixed; inset: 0`, sized to `window.innerWidth x window.innerHeight` (no DPR scaling). One canvas pixel = one CSS pixel.

**Home positions:** Sampled in font-pixel space (0 to ~280px wide, 0 to ~48px tall for 64px font). Stored as raw offsets from the text's top-left corner.

**Viewport mapping:** Each frame, `placeholder.getBoundingClientRect()` gives the heading's viewport position. The effective home position is:
```
effectiveHomeX = rect.left + homeX
effectiveHomeY = rect.top + homeY
```

**Mouse:** ShaderBackground provides mouse in `[clientX, innerHeight - clientY]` (Y-flipped for the flow field). The overlay un-flips Y: `mouseY = resolution[1] - uniforms.mouse[1]` to get back to viewport coordinates.

**Scroll:** As the page scrolls, `rect.top` changes. Particles follow automatically because the spring force pulls toward the updated effective home positions. When the heading scrolls off-screen, particles follow it off the top of the canvas — they're still simulated but clipped by the viewport.

**Vertex shader:** Unchanged. Maps CSS-pixel positions to clip space via `(pos / resolution) * 2.0 - 1.0` with Y flip. Works with viewport-scale coordinates since resolution = viewport size.

## 6. DPR Handling

The background canvas intentionally skips DPR scaling (comment in ShaderBackground: "no DPR — ambient effect doesn't need retina resolution"). Since text particles now share this canvas, they also render at 1x resolution.

On retina displays, the browser upscales the canvas output. A `gl_PointSize` of 3.0 renders as 3 canvas pixels, which the browser scales to 3 CSS pixels (6 physical pixels on 2x). The dots look slightly softer than a DPR-scaled canvas but this is consistent with the flow field particles and barely noticeable for small circles.

The renderer's `dpr` parameter is passed as `1` from the overlay. No DPR math anywhere.

## 7. Cleanup & Lifecycle

**Navigate to home page:**
1. ShaderBackground already mounted (layout), `shaderBridge.gl` is set
2. ParticleText mounts, `$effect` reads `shaderBridge.gl`
3. `document.fonts.ready` resolves → creates renderer + particles on shared GL
4. Registers overlay → background loop starts drawing text particles

**Navigate away from home page:**
1. ParticleText's `$effect` cleanup runs (page unmounts before layout conditionals)
2. Calls `overlay.destroy()` (deletes GL program, buffer, VAO on shared context)
3. Sets `shaderBridge.overlay = null`
4. Background loop continues drawing flow field only

**ShaderBackground unmounts** (navigating to blog/notes detail where `renderBackground` is false):
1. ShaderBackground cleanup cancels RAF, destroys flow field shader
2. Sets `shaderBridge.gl = null`
3. ParticleText (already unmounted since it's home-page-only) has nothing to clean up

**Mobile / reduced-motion:**
1. ShaderBackground sets `fallback = true`, doesn't create GL → `shaderBridge.gl` stays `null`
2. ParticleText sees no GL context available → shows static `<p>` fallback

## 8. Visual Result

- Flow field particles render as before (gray dots, trails, accent bursts)
- Text particles render on top with additive blending, in a brighter color (`vec3(0.88, 0.88, 0.92)`)
- Where text particles overlap with flow field particles, the additive blending creates subtle brightness interaction — text dots glow slightly brighter near flow particles
- The formation animation has particles converging from across the viewport, which looks more dramatic than the old canvas-local scatter
- Mouse repulsion works on text particles using the same cursor position as the flow field — unified interaction

---

## What Does NOT Change

- `flowField.ts` — completely untouched
- `webgl.ts` — interfaces unchanged
- Flow field rendering pipeline (trails, accent bursts, edge repulsion)
- ShaderBackground's canvas setup, mouse tracking, resize handling
- Mobile fallback behavior
- Other pages (blog, notes, projects, hundred, error)
- Accessibility (sr-only text still present)

## What Gets Removed

- ParticleText's own `<canvas>` element
- ParticleText's own WebGL2 context
- ParticleText's own `requestAnimationFrame` loop
- ParticleText's own mouse event listeners
- ParticleText's own resize handler
- The `topMargin` parameter from `createParticles` and overlay offset
- The `gl.clear` call from `createRenderer.draw`
- DPR scaling logic from ParticleText

## Testing

- Home page desktop: dots converge from across the viewport to form "Tim Cai"
- Mouse hover: dots ripple outward and spring back (same as before, but on the full-screen canvas)
- Scroll down: text particles move with the page content
- Scroll heading off-screen: particles follow and disappear naturally
- Navigate to /blog: particles disappear cleanly, flow field continues
- Navigate back to /: particles reform (fresh entrance animation)
- Mobile (< 640px): static "Tim Cai" heading, no WebGL
- Flow field particles still render normally around/behind the text
- No flicker, no layout shift, no console errors
