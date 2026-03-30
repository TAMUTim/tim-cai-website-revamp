# Particle Text Heading — Design Spec

## Goal

Replace the "Tim Cai" heading on the home page with an interactive particle text effect. The text is composed of small dots that ripple outward when the mouse moves over them, then spring back to reform the text. Uses a standalone WebGL2 canvas placed inline where the heading sits.

## Constraints

- No new dependencies
- Must not affect other pages or the existing flow field background shader
- HTML text stays in the DOM (hidden) for accessibility and SEO
- Mobile fallback: show the regular HTML heading (no WebGL)
- Must work with the existing `data-animate` stagger system

---

## 1. Text Sampling (Offscreen Canvas Technique)

**How it works:** The browser already knows how to render text. We use a temporary Canvas 2D context to rasterize the heading text, then read back which pixels were filled.

**Steps:**

1. Wait for the font to load: `await document.fonts.ready`
2. Create a small offscreen `<canvas>` (not added to DOM)
3. Set `ctx.font` to match the heading: `'600 48px "Space Grotesk"'` (matching `font-semibold text-5xl font-nabla`)
4. Measure text width with `ctx.measureText('Tim Cai')` — this also gives `actualBoundingBoxAscent` and `actualBoundingBoxDescent` for exact height
5. Size the offscreen canvas to fit the measured text dimensions
6. Call `ctx.fillText('Tim Cai', 0, ascent)` to render white text
7. Call `ctx.getImageData(0, 0, width, height)` to get the raw pixel array
8. Walk the pixel array in a grid pattern (every `N` pixels in x and y, where `N` controls dot density). For each pixel where `alpha > 128`, record `(x, y)` as a particle home position
9. Normalize positions relative to the measured text bounding box

**Sampling is a one-time operation** — it runs on mount only. The font size is fixed at 48px on desktop (`text-5xl`), so the sampled positions don't change. On window resize, only the canvas dimensions and coordinate mapping update (see Section 3). Re-sampling would only be needed if DPR changes (e.g., dragging between monitors), which is rare enough to ignore.

**Sampling density:** A grid step of 3px at 48px font size yields ~1000-1500 particles — dense enough to clearly read the text, sparse enough to see individual dots and keep performance trivial.

**Font loading:** `document.fonts.ready` returns a Promise that resolves when all fonts in the document's font face set have loaded. Since Space Grotesk is imported via Google Fonts in `main.css`, it will be in the set. If for some reason the font isn't available, the browser falls back to sans-serif — the sampling still works, just with a different glyph shape.

## 2. Component Architecture

**New file:** `src/lib/components/ParticleText.svelte`

**Props:** None. The text (`'Tim Cai'`), font (`'600 48px "Space Grotesk"'`), and mobile font (`'600 30px "Space Grotesk"'`) are hardcoded — this component has exactly one use site.

**Structure:**
```html
<!-- Accessible hidden heading -->
<p class="sr-only">Tim Cai</p>

<!-- WebGL canvas (desktop only) -->
<canvas bind:this={canvas} style="width: {width}px; height: {height}px;"></canvas>
```

The canvas is sized to match the text's bounding box — it's an inline element that takes up exactly the space the heading would. The container `<div>` in `+page.svelte` continues to control layout (left-alignment, max-width, padding).

**Mobile (< 640px):** Skip WebGL entirely, show the regular `<p>` heading with the current styling. Same pattern as `ShaderBackground.svelte`.

## 3. Canvas Sizing & DPR

The canvas dimensions match the text metrics:
- **Width:** Use the full content container width (the parent's client width). This ensures the canvas fills the same space as the `<p>` element it replaces. The text is left-aligned within it.
- **Height:** Derived from `ctx.measureText()` — specifically `actualBoundingBoxAscent + actualBoundingBoxDescent` plus a small vertical margin (~8px total) so dots at the edges don't clip.

**DPR scaling:** Unlike the background shader (which skips DPR because it's ambient), this component renders readable text and needs crisp dots on retina displays. Scale the canvas backing store by `window.devicePixelRatio`:
```
const dpr = window.devicePixelRatio || 1
canvas.width = displayWidth * dpr
canvas.height = displayHeight * dpr
canvas.style.width = displayWidth + 'px'
canvas.style.height = displayHeight + 'px'
```
All coordinate math (mouse position, particle positions, `gl.viewport`) must use the physical pixel dimensions (`displayWidth * dpr`). The sampled text positions (in font-pixel space) are mapped to physical canvas pixels when computing home positions. `gl_PointSize` should also scale by DPR so dots appear the same logical size.

**On window resize:** Update the canvas dimensions and coordinate mapping. Do **not** re-sample the text — the font size is fixed at 48px, so the sampled positions don't change. Just recompute the scale factor from normalized text coordinates to the new canvas size.

## 4. Particle Physics (CPU-Side)

Each particle stores:
- `homeX, homeY` — the sampled text position (fixed between resizes)
- `x, y` — current position
- `vx, vy` — velocity

**Per-frame update:**
```
// Spring force toward home
vx += (homeX - x) * springK
vy += (homeY - y) * springK

// Damping
vx *= damping
vy *= damping

// Mouse repulsion
if (distance to mouse < radius) {
    push away from mouse with strength proportional to closeness
}

// Integrate
x += vx
y += vy
```

**Why CPU, not GPU?** For ~1000 particles, CPU spring physics takes ~0.05ms per frame. Transform feedback would add shader complexity (new program, feedback objects, ping-pong buffers) for zero perceptible benefit. CPU update + `bufferSubData` upload (~8KB/frame) is the simplest correct approach.

**Tunable constants:**
| Constant | Value | Purpose |
|----------|-------|---------|
| `SPRING_K` | `0.08` | Spring stiffness — higher = snappier return |
| `DAMPING` | `0.85` | Velocity decay — higher = more sluggish |
| `MOUSE_RADIUS` | `80` | Repulsion radius in canvas pixels |
| `MOUSE_STRENGTH` | `8` | Repulsion push strength |
| `SAMPLE_STEP` | `3` | Pixel grid step for text sampling |
| `POINT_SIZE` | `2.0` | Rendered dot size |

All constants are defined at the top of the file for easy tuning.

## 5. WebGL Rendering

Minimal WebGL2 setup — no transform feedback, no FBOs, no trails. Just point sprites.

**Vertex shader:**
- Input: `a_position` (vec2, canvas-space coordinates updated each frame)
- Converts canvas coordinates to clip space: `clipPos = (pos / resolution) * 2.0 - 1.0`, with Y flipped
- Sets `gl_PointSize`

**Fragment shader:**
- Draws a soft circle (discard if `distance(gl_PointCoord, 0.5) > 0.5`)
- Color: soft white `vec3(0.88, 0.88, 0.92)` — close to `--c-slate-50` (#f8fafc), slightly dimmer so the dots feel atmospheric
- Alpha falloff toward the edge for a soft glow

**Per-frame flow:**
1. Update all particle positions on CPU (spring + repulsion)
2. Write new positions into a Float32Array
3. Upload via `gl.bufferSubData()`
4. Clear canvas (transparent background — `alpha: true` context)
5. Draw `gl.POINTS` with additive blending

**Canvas context options:** `{ alpha: true, antialias: false, premultipliedAlpha: false }` — `alpha: true` (unlike the background shader) so the dark page background shows through.

## 6. Entrance Animation

When the component mounts, particles start at **random positions** scattered across the canvas area, then spring to their home positions over ~1-2 seconds. This creates a "formation" effect — dots converging to spell out the name.

This happens naturally from the spring physics: set initial `(x, y)` to random positions within the canvas bounds, and the spring force pulls them home. No special animation code needed — just the physics doing its thing.

**Interaction with `data-animate`:** The current heading is inside a `<div>` with `data-animate` and `--stagger: 1`, which applies a 0.6s fade+slide entrance to the entire container (including paragraphs below the heading). The `ParticleText` component must be **separated from this container** so the formation animation plays at full opacity. Structure:

```html
<!-- ParticleText in its own container, no data-animate -->
<div class="w-full max-w-[40rem] px-5 sm:px-0">
    <ParticleText />
</div>

<!-- Remaining content keeps data-animate with stagger -->
<div class="w-full max-w-[40rem] px-5 sm:px-0" style="--stagger: 1" data-animate>
    <p>Howdy! My name is Tim Cai...</p>
    ...
</div>
```

This way the particle convergence is the heading's entrance, and the text below fades in independently via the stagger system.

## 7. Mouse Interaction

**Coordinate conversion:** The mouse position from `mousemove` events needs to be converted from page coordinates to canvas-local coordinates using `canvas.getBoundingClientRect()`:
```
const rect = canvas.getBoundingClientRect()
localX = e.clientX - rect.left
localY = e.clientY - rect.top
```

**Repulsion behavior:** Same ripple pattern as the existing flow field — particles near the cursor get pushed radially outward. The spring force then pulls them back when the mouse moves away. The interplay of repulsion and spring creates the ripple-and-reform effect.

**Mouse leave:** When the cursor leaves the canvas area, set mouse position to `(-1, -1)` to disable repulsion. Particles settle back to their home positions.

## 8. Cleanup

The component's `$effect` must return a cleanup function (same pattern as `ShaderBackground.svelte`) that:

1. Cancels the `requestAnimationFrame` loop
2. Deletes the WebGL program, buffers, and VAO via the GL API
3. Removes the `mousemove` and `mouseleave` event listeners from the canvas
4. Removes the `resize` event listener from `window`

This ensures proper resource release on navigation away from the home page (SvelteKit client-side routing) and prevents stale animation loops or leaked GL contexts.

## 9. Integration with Home Page

**Current `+page.svelte` heading (line 15):**
```html
<p class="text-3xl sm:text-5xl text-left font-semibold font-nabla text-slate-50">Tim Cai</p>
```

**Replace with:**
```html
<ParticleText />
```

The `ParticleText` component handles:
- Desktop: WebGL canvas with particle effect
- Mobile: Regular `<p>` element with the same classes as the current heading

The component sits inside its own container `<div>` (see Section 6 for the layout split from `data-animate`).

## 10. Mobile Fallback

On screens below `sm` (640px), skip WebGL and render:
```html
<p class="text-3xl font-semibold font-nabla text-slate-50">Tim Cai</p>
```

Detection: check `window.innerWidth < 640` on mount (same as `ShaderBackground.svelte`). Also skip if `prefers-reduced-motion: reduce` is set — show the static heading instead.

No resize listener to toggle between modes — if someone resizes across the 640px boundary, they get whichever mode was selected on mount. This matches the existing shader behavior.

## 11. Performance

| Metric | Value | Impact |
|--------|-------|--------|
| Particle count | ~1000-1500 | Trivial for CPU or GPU |
| CPU physics per frame | ~0.05ms | Unnoticeable |
| Buffer upload per frame | ~12KB (`bufferSubData`) | Negligible bandwidth |
| GPU draw calls | 1 (`gl.POINTS`) | Minimal |
| WebGL contexts on page | 2 (background + text) | Fine — browsers support many contexts |
| Text sampling | ~2ms one-time | Only on mount |
| Memory | ~100KB (particle arrays + GL buffers) | Negligible |

No performance concerns. This is significantly lighter than the background flow field shader (which runs 8000 particles with transform feedback, trail FBOs, and noise computation).

---

## What Does NOT Change

- Flow field background shader — completely independent
- All other pages — component only used on home page
- Page layout, spacing, typography of surrounding content
- Mobile experience (static text, same as current)
- Dark theme, CSS variables, accent colors
- Animation stagger system for non-heading content
- Accessibility — hidden `<p>` with `sr-only` class provides screen reader text

## Testing

- Verify text is readable as dots on desktop (try different viewport widths)
- Hover over text — dots should ripple outward and spring back
- Move mouse away — all dots should return to text positions within ~1-2 seconds
- Resize window — canvas should resize and dots should reposition correctly (no re-sampling)
- Check mobile (< 640px) — should show regular HTML heading
- Check `prefers-reduced-motion` — should show regular HTML heading
- Verify screen reader reads "Tim Cai" (sr-only element)
- Verify no horizontal scroll or layout shift
- Check that the flow field background still renders normally behind/around the heading
