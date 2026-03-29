# GPU Flow Field Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the p5.js Dots component with a zero-dependency WebGL2 particle system that renders a Perlin noise flow field on the GPU.

**Architecture:** A reusable `ShaderBackground.svelte` wrapper manages the WebGL2 lifecycle and render loop. A swappable `flowField.ts` module provides GLSL shaders and a factory function that sets up transform feedback for GPU particle simulation, framebuffer ping-pong for trails, and accent color bursts. A CSS-only fallback covers devices without WebGL2 or with `prefers-reduced-motion`.

**Tech Stack:** WebGL2, GLSL ES 3.0, SvelteKit 2, Svelte 5 (runes), TypeScript

---

### Task 1: Set up feature branch

**Files:**
- Stage: `src/routes/+page.svelte` (existing uncommitted changes)

- [ ] **Step 1: Create feature branch from main**

```bash
git checkout -b gpu-flow-field
```

- [ ] **Step 2: Stage and commit the user's +page.svelte content changes**

```bash
git add src/routes/+page.svelte
git commit -m "update homepage content and formatting"
```

Expected: Clean commit with the bio text updates.

---

### Task 2: Create WebGL types and utilities

**Files:**
- Create: `src/lib/components/shaders/webgl.ts`

- [ ] **Step 1: Create the shaders directory**

```bash
mkdir -p src/lib/components/shaders
```

- [ ] **Step 2: Write `webgl.ts` with shared types and helpers**

```typescript
// src/lib/components/shaders/webgl.ts

export interface FrameUniforms {
	time: number;
	deltaTime: number;
	resolution: [number, number];
	mouse: [number, number];
}

export interface ShaderInstance {
	draw(uniforms: FrameUniforms): void;
	resize(width: number, height: number): void;
	destroy(): void;
}

export type ShaderFactory = (
	gl: WebGL2RenderingContext,
	width: number,
	height: number,
	isMobile: boolean
) => ShaderInstance;

export function compileShader(
	gl: WebGL2RenderingContext,
	type: number,
	source: string
): WebGLShader {
	const shader = gl.createShader(type)!;
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const log = gl.getShaderInfoLog(shader);
		gl.deleteShader(shader);
		throw new Error(`Shader compile failed: ${log}`);
	}
	return shader;
}

export function createProgram(
	gl: WebGL2RenderingContext,
	vs: WebGLShader,
	fs: WebGLShader,
	feedbackVaryings?: string[]
): WebGLProgram {
	const program = gl.createProgram()!;
	gl.attachShader(program, vs);
	gl.attachShader(program, fs);
	if (feedbackVaryings) {
		gl.transformFeedbackVaryings(program, feedbackVaryings, gl.INTERLEAVED_ATTRIBS);
	}
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const log = gl.getProgramInfoLog(program);
		gl.deleteProgram(program);
		throw new Error(`Program link failed: ${log}`);
	}
	return program;
}
```

- [ ] **Step 3: Verify no TypeScript errors**

Run: `npx svelte-check --tsconfig ./tsconfig.json 2>&1 | grep -E "Error|webgl"`

Expected: No errors referencing `webgl.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/shaders/webgl.ts
git commit -m "add WebGL2 types and utility helpers"
```

---

### Task 3: Create flow field shader module

**Files:**
- Create: `src/lib/components/shaders/flowField.ts`

- [ ] **Step 1: Write `flowField.ts` with GLSL shaders, config, and factory**

This is the core file. It contains all GLSL source strings, configurable constants, and the `createFlowField` factory function that sets up WebGL2 transform feedback, framebuffer ping-pong for trails, and the render pipeline.

```typescript
// src/lib/components/shaders/flowField.ts

import { type ShaderFactory, type FrameUniforms, compileShader, createProgram } from './webgl';

// --- Configurable Constants ---

export const PARTICLE_COUNT_DESKTOP = 8000;
export const PARTICLE_COUNT_MOBILE = 3000;
export const NOISE_SCALE = 250.0;
export const FLOW_SPEED = 0.0001;
export const FLOW_FORCE = 0.000005;
export const TRAIL_FADE = 0.93;
export const MOUSE_RADIUS = 150.0;
export const MOUSE_STRENGTH = 0.002;
export const ACCENT_INTERVAL = 8000;
export const ACCENT_DURATION = 2000;
export const POINT_SIZE = 1.5;

// --- GLSL: Simplex 3D Noise (Ashima Arts, MIT license) ---

const NOISE_GLSL = `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

// --- Update Shaders (Transform Feedback) ---
// Reads particle state, applies noise flow + mouse repulsion, outputs new state.
// Fragment shader is unused (RASTERIZER_DISCARD) but required for linking.

const UPDATE_VS = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_velocity;
in float a_opacity;

uniform float u_time;
uniform float u_deltaTime;
uniform float u_noiseScale;
uniform float u_flowSpeed;
uniform float u_flowForce;
uniform vec2 u_mouse;
uniform vec2 u_resolution;
uniform float u_mouseRadius;
uniform float u_mouseStrength;

out vec2 v_position;
out vec2 v_velocity;
out float v_opacity;

${NOISE_GLSL}

void main() {
  vec2 pos = a_position;
  vec2 vel = a_velocity;
  float dt = min(u_deltaTime, 0.05) * 60.0; // normalize to 60fps

  vec2 pixelPos = pos * u_resolution;
  float angle = snoise(vec3(pixelPos / u_noiseScale, u_time * u_flowSpeed)) * 6.28318;
  vec2 flow = vec2(cos(angle), sin(angle));

  // Mouse repulsion (u_mouse is in pixel space, -1 means inactive)
  if (u_mouse.x >= 0.0) {
    vec2 diff = pixelPos - u_mouse;
    float dist = length(diff);
    if (dist < u_mouseRadius && dist > 1.0) {
      float strength = (1.0 - dist / u_mouseRadius) * u_mouseStrength;
      vel += normalize(diff) * strength * dt;
    }
  }

  vel = vel * exp(-2.0 * u_deltaTime) + flow * u_flowForce * dt;

  float speed = length(vel);
  if (speed > 0.005) vel = vel / speed * 0.005;

  pos += vel * dt;
  pos = fract(pos + 1.0);

  v_position = pos;
  v_velocity = vel;
  v_opacity = a_opacity;
}
`;

const UPDATE_FS = `#version 300 es
precision highp float;
void main() { discard; }
`;

// --- Render Shaders ---
// Draws particles as gl.POINTS with monochrome + accent burst coloring.

const RENDER_VS = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_velocity;
in float a_opacity;

uniform float u_pointSize;

out float v_opacity;
out float v_speed;
out vec2 v_worldPos;

void main() {
  vec2 clipPos = a_position * 2.0 - 1.0;
  gl_Position = vec4(clipPos, 0.0, 1.0);
  gl_PointSize = u_pointSize;
  v_opacity = a_opacity;
  v_speed = length(a_velocity);
  v_worldPos = a_position;
}
`;

const RENDER_FS = `#version 300 es
precision highp float;

in float v_opacity;
in float v_speed;
in vec2 v_worldPos;

uniform float u_accentPhase;
uniform vec2 u_accentCenter;

out vec4 fragColor;

void main() {
  float dist = length(gl_PointCoord - 0.5);
  if (dist > 0.5) discard;

  float alpha = v_opacity * (1.0 - dist * 2.0) * 0.5;
  vec3 color = vec3(0.85, 0.85, 0.88);

  if (u_accentPhase > 0.0) {
    float ad = length(v_worldPos - u_accentCenter);
    float ripple = smoothstep(0.3, 0.0, abs(ad - u_accentPhase * 0.8));
    vec3 gold = mix(vec3(1.0, 0.82, 0.08), vec3(1.0, 0.61, 0.0), clamp(ad, 0.0, 1.0));
    color = mix(color, gold, ripple * 0.7);
    alpha *= 1.0 + ripple * 0.5;
  }

  alpha *= 0.5 + clamp(v_speed * 2000.0, 0.0, 1.0);
  fragColor = vec4(color, alpha);
}
`;

// --- Quad Shaders (for trail framebuffer blit) ---

const QUAD_VS = `#version 300 es
in vec2 a_position;
out vec2 v_texCoord;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_position * 0.5 + 0.5;
}
`;

const QUAD_FS = `#version 300 es
precision highp float;
in vec2 v_texCoord;
uniform sampler2D u_texture;
uniform float u_opacity;
out vec4 fragColor;
void main() {
  vec4 c = texture(u_texture, v_texCoord);
  fragColor = vec4(c.rgb * u_opacity, 1.0);
}
`;

// --- Factory ---

export const createFlowField: ShaderFactory = (gl, width, height, isMobile) => {
	const particleCount = isMobile ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP;
	const trailsEnabled = !isMobile;

	// --- Compile programs ---
	const updateProg = createProgram(
		gl,
		compileShader(gl, gl.VERTEX_SHADER, UPDATE_VS),
		compileShader(gl, gl.FRAGMENT_SHADER, UPDATE_FS),
		['v_position', 'v_velocity', 'v_opacity']
	);

	const renderProg = createProgram(
		gl,
		compileShader(gl, gl.VERTEX_SHADER, RENDER_VS),
		compileShader(gl, gl.FRAGMENT_SHADER, RENDER_FS)
	);

	const quadProg = trailsEnabled
		? createProgram(
				gl,
				compileShader(gl, gl.VERTEX_SHADER, QUAD_VS),
				compileShader(gl, gl.FRAGMENT_SHADER, QUAD_FS)
			)
		: null;

	// --- Initialize particle data ---
	const STRIDE = 5 * 4; // 5 floats * 4 bytes = 20 bytes per particle
	const data = new Float32Array(particleCount * 5);
	for (let i = 0; i < particleCount; i++) {
		const o = i * 5;
		data[o] = Math.random(); // x [0,1]
		data[o + 1] = Math.random(); // y [0,1]
		data[o + 2] = 0; // vx
		data[o + 3] = 0; // vy
		data[o + 4] = Math.random() * 0.5 + 0.5; // opacity
	}

	// --- Create particle buffers (ping-pong pair) ---
	const particleBufs = [gl.createBuffer()!, gl.createBuffer()!];
	for (const buf of particleBufs) {
		gl.bindBuffer(gl.ARRAY_BUFFER, buf);
		gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_COPY);
	}

	// --- Helper: set up particle attribute pointers on a VAO ---
	function setupParticleVAO(program: WebGLProgram, buf: WebGLBuffer): WebGLVertexArrayObject {
		const vao = gl.createVertexArray()!;
		gl.bindVertexArray(vao);
		gl.bindBuffer(gl.ARRAY_BUFFER, buf);

		const posLoc = gl.getAttribLocation(program, 'a_position');
		const velLoc = gl.getAttribLocation(program, 'a_velocity');
		const opLoc = gl.getAttribLocation(program, 'a_opacity');

		gl.enableVertexAttribArray(posLoc);
		gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, STRIDE, 0);
		gl.enableVertexAttribArray(velLoc);
		gl.vertexAttribPointer(velLoc, 2, gl.FLOAT, false, STRIDE, 8);
		gl.enableVertexAttribArray(opLoc);
		gl.vertexAttribPointer(opLoc, 1, gl.FLOAT, false, STRIDE, 16);

		gl.bindVertexArray(null);
		return vao;
	}

	const updateVAOs = particleBufs.map((buf) => setupParticleVAO(updateProg, buf));
	const renderVAOs = particleBufs.map((buf) => setupParticleVAO(renderProg, buf));

	// --- Transform feedback objects (one per output buffer) ---
	const tfs = particleBufs.map((buf) => {
		const tf = gl.createTransformFeedback()!;
		gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf);
		gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, buf);
		gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
		return tf;
	});

	// --- Quad geometry (fullscreen triangle strip) ---
	let quadVAO: WebGLVertexArrayObject | null = null;
	let quadBuf: WebGLBuffer | null = null;
	if (quadProg) {
		quadBuf = gl.createBuffer()!;
		gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
			gl.STATIC_DRAW
		);
		quadVAO = gl.createVertexArray()!;
		gl.bindVertexArray(quadVAO);
		gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
		const loc = gl.getAttribLocation(quadProg, 'a_position');
		gl.enableVertexAttribArray(loc);
		gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
		gl.bindVertexArray(null);
	}

	// --- Trail FBOs (ping-pong pair) ---
	let trailTextures: WebGLTexture[] = [];
	let trailFBOs: WebGLFramebuffer[] = [];

	function createTrailFBOs(w: number, h: number) {
		for (const t of trailTextures) gl.deleteTexture(t);
		for (const f of trailFBOs) gl.deleteFramebuffer(f);
		trailTextures = [];
		trailFBOs = [];
		if (!trailsEnabled) return;

		for (let i = 0; i < 2; i++) {
			const tex = gl.createTexture()!;
			gl.bindTexture(gl.TEXTURE_2D, tex);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

			const fbo = gl.createFramebuffer()!;
			gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
			gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
			gl.clearColor(0, 0, 0, 1);
			gl.clear(gl.COLOR_BUFFER_BIT);

			trailTextures.push(tex);
			trailFBOs.push(fbo);
		}
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	}

	createTrailFBOs(width, height);

	// --- State ---
	let curBuf = 0;
	let curTrail = 0;
	let accentStart = performance.now();
	let accentCenter: [number, number] = [Math.random(), Math.random()];

	// --- Uniform locations ---
	const uUpdate = {
		time: gl.getUniformLocation(updateProg, 'u_time'),
		deltaTime: gl.getUniformLocation(updateProg, 'u_deltaTime'),
		noiseScale: gl.getUniformLocation(updateProg, 'u_noiseScale'),
		flowSpeed: gl.getUniformLocation(updateProg, 'u_flowSpeed'),
		flowForce: gl.getUniformLocation(updateProg, 'u_flowForce'),
		mouse: gl.getUniformLocation(updateProg, 'u_mouse'),
		resolution: gl.getUniformLocation(updateProg, 'u_resolution'),
		mouseRadius: gl.getUniformLocation(updateProg, 'u_mouseRadius'),
		mouseStrength: gl.getUniformLocation(updateProg, 'u_mouseStrength'),
	};
	const uRender = {
		pointSize: gl.getUniformLocation(renderProg, 'u_pointSize'),
		accentPhase: gl.getUniformLocation(renderProg, 'u_accentPhase'),
		accentCenter: gl.getUniformLocation(renderProg, 'u_accentCenter'),
	};
	const uQuad = quadProg
		? {
				texture: gl.getUniformLocation(quadProg, 'u_texture'),
				opacity: gl.getUniformLocation(quadProg, 'u_opacity'),
			}
		: null;

	return {
		draw(uniforms: FrameUniforms) {
			const { time, deltaTime, resolution, mouse } = uniforms;
			const next = 1 - curBuf;

			// === UPDATE pass (transform feedback) ===
			gl.useProgram(updateProg);
			gl.uniform1f(uUpdate.time, time);
			gl.uniform1f(uUpdate.deltaTime, Math.min(deltaTime, 0.05));
			gl.uniform1f(uUpdate.noiseScale, NOISE_SCALE);
			gl.uniform1f(uUpdate.flowSpeed, FLOW_SPEED);
			gl.uniform1f(uUpdate.flowForce, FLOW_FORCE);
			gl.uniform2f(uUpdate.mouse, mouse[0], mouse[1]);
			gl.uniform2f(uUpdate.resolution, resolution[0], resolution[1]);
			gl.uniform1f(uUpdate.mouseRadius, MOUSE_RADIUS);
			gl.uniform1f(uUpdate.mouseStrength, MOUSE_STRENGTH);

			gl.bindVertexArray(updateVAOs[curBuf]);
			gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tfs[next]);

			gl.enable(gl.RASTERIZER_DISCARD);
			gl.beginTransformFeedback(gl.POINTS);
			gl.drawArrays(gl.POINTS, 0, particleCount);
			gl.endTransformFeedback();
			gl.disable(gl.RASTERIZER_DISCARD);

			gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
			gl.bindVertexArray(null);

			// === Accent burst timing ===
			const now = performance.now();
			const accentElapsed = now - accentStart;
			let accentPhase = 0;
			if (accentElapsed < ACCENT_DURATION) {
				accentPhase = accentElapsed / ACCENT_DURATION;
			} else if (accentElapsed > ACCENT_INTERVAL) {
				accentStart = now;
				accentCenter = [Math.random(), Math.random()];
			}

			// === RENDER pass ===
			const ptSize = POINT_SIZE * (resolution[0] > 768 ? 1.0 : 0.8);

			if (trailsEnabled && quadProg && quadVAO && trailFBOs.length === 2) {
				const nextTrail = 1 - curTrail;

				// Draw faded previous frame into FBO[nextTrail]
				gl.bindFramebuffer(gl.FRAMEBUFFER, trailFBOs[nextTrail]);
				gl.viewport(0, 0, resolution[0], resolution[1]);
				gl.clearColor(0, 0, 0, 1);
				gl.clear(gl.COLOR_BUFFER_BIT);

				gl.useProgram(quadProg);
				gl.uniform1i(uQuad!.texture, 0);
				gl.uniform1f(uQuad!.opacity, TRAIL_FADE);
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, trailTextures[curTrail]);
				gl.bindVertexArray(quadVAO);
				gl.disable(gl.BLEND);
				gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

				// Draw particles on top with additive blending
				gl.useProgram(renderProg);
				gl.uniform1f(uRender.pointSize, ptSize);
				gl.uniform1f(uRender.accentPhase, accentPhase);
				gl.uniform2f(uRender.accentCenter, accentCenter[0], accentCenter[1]);
				gl.enable(gl.BLEND);
				gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
				gl.bindVertexArray(renderVAOs[next]);
				gl.drawArrays(gl.POINTS, 0, particleCount);

				// Blit FBO to screen
				gl.bindFramebuffer(gl.FRAMEBUFFER, null);
				gl.viewport(0, 0, resolution[0], resolution[1]);
				gl.clearColor(0.008, 0.008, 0.008, 1);
				gl.clear(gl.COLOR_BUFFER_BIT);
				gl.useProgram(quadProg);
				gl.uniform1f(uQuad!.opacity, 1.0);
				gl.bindTexture(gl.TEXTURE_2D, trailTextures[nextTrail]);
				gl.bindVertexArray(quadVAO);
				gl.disable(gl.BLEND);
				gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

				curTrail = nextTrail;
			} else {
				// No trails — render directly to screen
				gl.bindFramebuffer(gl.FRAMEBUFFER, null);
				gl.viewport(0, 0, resolution[0], resolution[1]);
				gl.clearColor(0.008, 0.008, 0.008, 1);
				gl.clear(gl.COLOR_BUFFER_BIT);

				gl.useProgram(renderProg);
				gl.uniform1f(uRender.pointSize, ptSize);
				gl.uniform1f(uRender.accentPhase, accentPhase);
				gl.uniform2f(uRender.accentCenter, accentCenter[0], accentCenter[1]);
				gl.enable(gl.BLEND);
				gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
				gl.bindVertexArray(renderVAOs[next]);
				gl.drawArrays(gl.POINTS, 0, particleCount);
			}

			gl.bindVertexArray(null);
			curBuf = next;
		},

		resize(w: number, h: number) {
			createTrailFBOs(w, h);
		},

		destroy() {
			gl.deleteProgram(updateProg);
			gl.deleteProgram(renderProg);
			if (quadProg) gl.deleteProgram(quadProg);
			for (const b of particleBufs) gl.deleteBuffer(b);
			for (const v of [...updateVAOs, ...renderVAOs]) gl.deleteVertexArray(v);
			if (quadVAO) gl.deleteVertexArray(quadVAO);
			if (quadBuf) gl.deleteBuffer(quadBuf);
			for (const tf of tfs) gl.deleteTransformFeedback(tf);
			for (const t of trailTextures) gl.deleteTexture(t);
			for (const f of trailFBOs) gl.deleteFramebuffer(f);
		},
	};
};
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx svelte-check --tsconfig ./tsconfig.json 2>&1 | grep -E "Error|flowField"`

Expected: No errors referencing `flowField.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/shaders/flowField.ts
git commit -m "add GPU flow field shader with transform feedback and trails"
```

---

### Task 4: Create ShaderBackground component

**Files:**
- Create: `src/lib/components/ShaderBackground.svelte`

- [ ] **Step 1: Write `ShaderBackground.svelte`**

This component is shader-agnostic — it manages the WebGL2 lifecycle, render loop, mouse tracking, resize handling, and fallback. It receives a `ShaderFactory` prop and delegates all rendering to the shader module.

```svelte
<!-- src/lib/components/ShaderBackground.svelte -->
<script lang="ts">
	import { browser } from '$app/environment';
	import type { ShaderFactory, FrameUniforms } from './shaders/webgl';

	interface Props {
		createShader: ShaderFactory;
	}

	let { createShader }: Props = $props();

	let canvas: HTMLCanvasElement;
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
			gl.viewport(0, 0, width, height);
			shader.resize(width, height);
		}

		canvas.width = width;
		canvas.height = height;
		gl.viewport(0, 0, width, height);

		const shader = createShader(gl, width, height, isMobile);

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
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx svelte-check --tsconfig ./tsconfig.json 2>&1 | grep -E "Error|ShaderBackground"`

Expected: No errors referencing `ShaderBackground.svelte`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/ShaderBackground.svelte
git commit -m "add reusable ShaderBackground component with WebGL2 lifecycle"
```

---

### Task 5: Integrate into layout

**Files:**
- Modify: `src/routes/+layout.svelte`

- [ ] **Step 1: Replace Dots with ShaderBackground in the layout**

In `src/routes/+layout.svelte`, make these changes:

1. Replace the Dots import with ShaderBackground and createFlowField:

Replace:
```typescript
import Dots from '$lib/components/Dots.svelte';
```
With:
```typescript
import ShaderBackground from '$lib/components/ShaderBackground.svelte';
import { createFlowField } from '$lib/components/shaders/flowField';
```

2. Rename `renderDots` to `renderBackground`:

Replace:
```typescript
let renderDots = $derived(!($page.url.pathname.includes('blog/') || $page.url.pathname.includes('notes/')));
```
With:
```typescript
let renderBackground = $derived(!($page.url.pathname.includes('blog/') || $page.url.pathname.includes('notes/')));
```

3. Replace the Dots usage with ShaderBackground:

Replace:
```svelte
{#if browser && renderDots}
    <Dots />
{/if}
```
With:
```svelte
{#if browser && renderBackground}
    <ShaderBackground createShader={createFlowField} />
{/if}
```

- [ ] **Step 2: Run dev server to verify it loads**

Run: `npm run dev`

Open http://localhost:5173 in the browser. Expected:
- Flowing particles visible on the dark background
- Content text visible above the particles
- Nav links functional
- No console errors

- [ ] **Step 3: Commit**

```bash
git add src/routes/+layout.svelte
git commit -m "integrate ShaderBackground into layout, replacing Dots"
```

---

### Task 6: Remove p5.js dependencies

**Files:**
- Delete: `src/lib/components/Dots.svelte`
- Modify: `package.json` (remove `p5` and `@types/p5`)
- Modify: `vite.config.ts` (remove `optimizeDeps.include`)

- [ ] **Step 1: Delete Dots.svelte**

```bash
rm src/lib/components/Dots.svelte
```

- [ ] **Step 2: Remove p5 from package.json**

In `package.json`, remove these lines:
- From `dependencies`: `"p5": "^2.2.3",`
- From `devDependencies`: `"@types/p5": "^1.7.6",`

- [ ] **Step 3: Remove p5 from vite.config.ts**

In `vite.config.ts`, remove the `optimizeDeps` block:

Replace:
```typescript
export default defineConfig({
	server: {
		fs: {
			allow: [
				searchForWorkspaceRoot(process.cwd()),
				'/public',
			],
		},
	},
	optimizeDeps: {
		include: ['p5']
	},
	plugins: [sveltekit()]
});
```
With:
```typescript
export default defineConfig({
	server: {
		fs: {
			allow: [
				searchForWorkspaceRoot(process.cwd()),
				'/public',
			],
		},
	},
	plugins: [sveltekit()]
});
```

- [ ] **Step 4: Reinstall dependencies**

```bash
npm install
```

Expected: No errors. `p5` and `@types/p5` should no longer appear in `node_modules`.

- [ ] **Step 5: Update CLAUDE.md**

In `CLAUDE.md`, update the architecture description and key components to reflect the new system:

Replace:
```markdown
SvelteKit personal website with file-based markdown content, p5.js background animations, and Tailwind CSS styling.
```
With:
```markdown
SvelteKit personal website with file-based markdown content, WebGL2 background animations, and Tailwind CSS styling.
```

Replace:
```markdown
- `src/lib/components/Dots.svelte` — p5.js Perlin noise particle background (HSL color cycling)
- `src/routes/+layout.svelte` — global layout with nav, footer, scroll button, and dots background
```
With:
```markdown
- `src/lib/components/ShaderBackground.svelte` — reusable WebGL2 background wrapper (shader-agnostic)
- `src/lib/components/shaders/flowField.ts` — GPU flow field particle shader (transform feedback, trails, accent bursts)
- `src/lib/components/shaders/webgl.ts` — shared WebGL2 types and utilities
- `src/routes/+layout.svelte` — global layout with nav, footer, scroll button, and shader background
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "remove p5.js dependency and Dots component, update CLAUDE.md"
```

---

### Task 7: Build and verify

**Files:** None (verification only)

- [ ] **Step 1: Run type check**

```bash
npm run check
```

Expected: No errors. The build should pass cleanly — all WebGL code is client-side only (guarded by `browser` check in ShaderBackground).

- [ ] **Step 2: Run production build**

```bash
npm run build
```

Expected: Build succeeds with no SSR errors. WebGL code is never executed during SSR because of the `browser` guard.

- [ ] **Step 3: Preview production build**

```bash
npm run preview
```

Open http://localhost:4173 and verify:
- Particles flow smoothly on the homepage
- Nav and content render above the particles
- Mouse repulsion works (move cursor around)
- Navigating to `/blog` hides the background
- Navigating back to `/` restores the background
- No console errors

- [ ] **Step 4: Visual verification checklist**

Run `npm run dev` and check each item:

| Check | How to verify |
|---|---|
| Particles visible | Homepage shows flowing white/grey dots |
| Medium density | Similar visual density to the old Dots |
| Accent bursts | Wait ~8 seconds, gold/orange ripple appears |
| Mouse repulsion | Move cursor — nearby particles push away |
| Resize | Resize browser window — canvas adapts, no glitches |
| Mobile tier | DevTools responsive mode at 375px — fewer particles, no trails |
| Fallback | In DevTools console: override `HTMLCanvasElement.prototype.getContext` to return null for 'webgl2', reload — CSS gradient fallback appears |
| Performance | DevTools Performance tab — frame time well under 16ms |
| Blog nav | Click Blog link — background disappears, content renders |
| Return home | Click home — background reappears |

- [ ] **Step 5: Commit any fixes from verification**

If any fixes were needed during verification, commit them:

```bash
git add -A
git commit -m "fix: address issues found during visual verification"
```

If no fixes were needed, skip this step.
