# GPU Flow Field Background

Replace the p5.js Dots component with a zero-dependency WebGL2 particle system. The new background renders a Perlin noise flow field entirely on the GPU via transform feedback, with very short trails, subtle mouse interaction, and a CSS-only fallback for low-power devices.

## Goals

- **Performance**: Move all particle computation to the GPU. Drop p5.js (~800kb). Single draw call per frame.
- **Visual quality**: Monochrome particles (white/grey) with occasional gold/orange accent bursts. Medium density, ambient feel.
- **Lightweight**: 5k–10k particles, not 50k. This is a background, not a demo scene.
- **Transferability**: Reusable `ShaderBackground.svelte` wrapper — swap the shader module to completely change the visual.
- **Compatibility**: WebGL2 (universal in 2026). CSS fallback for devices without it.

## Architecture

### Component Structure

```
src/lib/components/
├── ShaderBackground.svelte    # Reusable WebGL2 wrapper
├── shaders/
│   └── flowField.ts           # Flow field shader source + config
└── Dots.svelte                # Removed (replaced)
```

### ShaderBackground.svelte

Responsibilities:
- Create and manage a `<canvas>` element with `position: fixed; inset: 0`
- Initialize WebGL2 context
- Run the render loop via `requestAnimationFrame`
- Pass uniforms each frame: `u_time`, `u_resolution`, `u_mouse`, `u_scrollY`
- Detect device capability and choose rendering tier
- Clean up WebGL resources on component destroy via `$effect` return

This component is shader-agnostic. It receives shader source strings and a configuration object, making it reusable for future background designs.

### flowField.ts

Contains:
- GLSL simplex noise function (3D)
- **Update vertex shader**: reads particle position/velocity from buffer, applies noise-based flow field forces, writes new position via transform feedback
- **Render vertex shader**: positions particles as `gl.POINTS`
- **Render fragment shader**: colors particles (monochrome base + accent bursts), applies opacity based on age/velocity
- Exported configuration: particle count, noise scale, flow speed, color palette, mouse influence radius

## Visual Design

### Color Palette

- **Primary particles**: `rgba(255, 255, 255, 0.4–0.7)` — soft white dots
- **Secondary particles**: `rgba(200, 200, 210, 0.2–0.4)` — dimmer grey
- **Accent burst**: `rgba(255, 210, 20, 0.6–0.9)` — gold, from CSS `--c-accent`
- **Accent secondary**: `rgba(255, 155, 0, 0.4–0.7)` — orange, from CSS `--c-accent-secondary`

Accent bursts are periodic — a ripple of gold/orange color propagates through nearby particles every few seconds, then fades back to monochrome.

### Particle Behavior

- Particles flow along a 3D simplex noise field (2D position + time as z-axis)
- Noise scale ~200–300px (similar to current `SCALE = 300`)
- Flow speed is slow and ambient — particles drift, not race
- Particles that exit the viewport wrap to the opposite edge
- Each particle has a random opacity multiplier for visual depth

### Trails

- Implemented via framebuffer feedback (ping-pong render targets)
- Previous frame rendered at ~93% opacity before new particles are drawn on top
- Creates very short streaks behind moving particles
- **Removable**: if trails cause performance issues, disable the feedback pass and render directly to screen (single config flag)

### Mouse Interaction

- Particles within ~150px of the cursor are gently repelled
- Repulsion force falls off with distance (inverse square or linear)
- Mouse position passed as `u_mouse` uniform, applied in the update vertex shader
- No interaction on touch devices (fallback to ambient-only)

## Performance Tiers

### Desktop (default)
- Full WebGL2 with transform feedback
- 8k–10k particles
- Trails enabled
- Mouse interaction enabled
- Target: 60fps with minimal GPU load

### Capable Mobile
- Same WebGL2 code path
- 3k–5k particles (scaled by viewport area)
- Trails disabled
- No mouse interaction
- Target: 60fps

### Low-Power Fallback
- Triggered if: WebGL2 context creation fails
- CSS-only: subtle animated radial gradient or static noise texture
- Zero JS animation overhead

### Detection Strategy
- Attempt `canvas.getContext('webgl2')`
- If it fails → CSS fallback
- If it succeeds, check `viewport width < 768` → mobile tier (reduced particles, no trails)
- Otherwise → desktop tier
- Particle count exposed as a configurable constant for easy tuning

## Integration

### Layout Changes

In `+layout.svelte`:
- Replace `<Dots />` import with `<ShaderBackground />`
- Remove the `invert` CSS class (no longer needed — rendering directly on dark bg)
- Keep the same conditional: only render on non-blog/notes slug pages
- Canvas uses `position: fixed` instead of `absolute`, covering the viewport not the document

### Removed

- `src/lib/components/Dots.svelte` — deleted
- `p5` and `@types/p5` dependencies — removed from `package.json`
- `vite.config.ts` `optimizeDeps.include: ['p5']` — removed

### CSS Changes

- No `invert` class needed on the canvas container
- Canvas: `position: fixed; inset: 0; z-index: 0; pointer-events: none;`
- Existing nav `z-index: 10` stays above the canvas

## Configurable Constants

All tuning knobs in one place (exported from `flowField.ts`):

| Constant | Default | Description |
|---|---|---|
| `PARTICLE_COUNT_DESKTOP` | 8000 | Particles on desktop |
| `PARTICLE_COUNT_MOBILE` | 3000 | Particles on mobile |
| `NOISE_SCALE` | 250 | Noise sample spacing (px) |
| `FLOW_SPEED` | 0.0001 | Time multiplier for noise z-axis |
| `TRAIL_FADE` | 0.93 | Framebuffer feedback opacity (0 = no trails, 1 = permanent) |
| `MOUSE_RADIUS` | 150 | Mouse repulsion radius (px) |
| `MOUSE_STRENGTH` | 0.5 | Mouse repulsion force |
| `ACCENT_INTERVAL` | 8000 | Milliseconds between accent color bursts |
| `ACCENT_DURATION` | 2000 | How long an accent burst lasts (ms) |
| `POINT_SIZE` | 1.5 | Particle render size (px) |

## Testing

- **Visual**: Run `npm run dev`, verify particles flow smoothly on dark background
- **Performance**: Check DevTools Performance tab — GPU frame time should be <2ms
- **Mouse**: Move cursor around, verify subtle repulsion
- **Resize**: Resize browser window, verify canvas adapts without glitches
- **Mobile**: Use DevTools responsive mode at 375px width, verify reduced particle count
- **Fallback**: Force fallback by temporarily returning `null` from `getContext('webgl2')`, verify CSS gradient appears
- **Navigation**: Navigate to a blog post, verify background is hidden. Navigate back, verify it reappears
- **Build**: Run `npm run build` — no SSR errors (WebGL is client-side only)
