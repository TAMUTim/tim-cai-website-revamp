import { type ShaderFactory, type FrameUniforms, compileShader, createProgram } from './webgl'

// --- Configurable Constants ---

export const PARTICLE_COUNT_DESKTOP = 8000
export const PARTICLE_COUNT_MOBILE = 3000
export const NOISE_SCALE = 250.0
export const FLOW_SPEED = 0.0001
export const FLOW_FORCE = 0.000005
export const TRAIL_FADE = 0.85
export const MOUSE_RADIUS = 50.0
export const MOUSE_STRENGTH = 0.0008
export const ACCENT_INTERVAL = 8000
export const ACCENT_DURATION = 2000
export const POINT_SIZE = 2.5

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
`

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
  float angle = snoise(vec3(pixelPos / u_noiseScale, u_time * u_flowSpeed + a_opacity * 10.0)) * 6.28318;
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

  // Edge repulsion — push particles away from boundaries
  float edgeMargin = 0.07;
  float edgeForce = 0.0001;
  if (pos.x < edgeMargin) vel.x += (edgeMargin - pos.x) / edgeMargin * edgeForce * dt;
  if (pos.x > 1.0 - edgeMargin) vel.x -= (pos.x - (1.0 - edgeMargin)) / edgeMargin * edgeForce * dt;
  if (pos.y < edgeMargin) vel.y += (edgeMargin - pos.y) / edgeMargin * edgeForce * dt;
  if (pos.y > 1.0 - edgeMargin) vel.y -= (pos.y - (1.0 - edgeMargin)) / edgeMargin * edgeForce * dt;

  vel = vel * exp(-2.0 * u_deltaTime) + flow * u_flowForce * dt;

  float speed = length(vel);
  if (speed > 0.005) vel = vel / speed * 0.005;

  pos += vel * dt;
  pos = fract(pos + 1.0);

  v_position = pos;
  v_velocity = vel;
  v_opacity = a_opacity;
}
`

const UPDATE_FS = `#version 300 es
precision highp float;
void main() { discard; }
`

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
`

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
  vec3 color = vec3(0.35, 0.35, 0.40);

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
`

// --- Quad Shaders (for trail framebuffer blit) ---

const QUAD_VS = `#version 300 es
in vec2 a_position;
out vec2 v_texCoord;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_position * 0.5 + 0.5;
}
`

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
`

// --- Factory ---

export const createFlowField: ShaderFactory = (gl, width, height, isMobile) => {
	const particleCount = isMobile ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP
	const trailsEnabled = !isMobile

	// --- Compile programs ---
	const updateProg = createProgram(
		gl,
		compileShader(gl, gl.VERTEX_SHADER, UPDATE_VS),
		compileShader(gl, gl.FRAGMENT_SHADER, UPDATE_FS),
		['v_position', 'v_velocity', 'v_opacity']
	)

	const renderProg = createProgram(
		gl,
		compileShader(gl, gl.VERTEX_SHADER, RENDER_VS),
		compileShader(gl, gl.FRAGMENT_SHADER, RENDER_FS)
	)

	const quadProg = trailsEnabled
		? createProgram(
				gl,
				compileShader(gl, gl.VERTEX_SHADER, QUAD_VS),
				compileShader(gl, gl.FRAGMENT_SHADER, QUAD_FS)
			)
		: null

	// --- Initialize particle data ---
	const STRIDE = 5 * 4 // 5 floats * 4 bytes = 20 bytes per particle
	const data = new Float32Array(particleCount * 5)
	const spawnMargin = 0.07
	const spawnRange = 1.0 - 2.0 * spawnMargin
	for (let i = 0; i < particleCount; i++) {
		const o = i * 5
		data[o] = spawnMargin + Math.random() * spawnRange // x [0.07, 0.93]
		data[o + 1] = spawnMargin + Math.random() * spawnRange // y [0.07, 0.93]
		data[o + 2] = (Math.random() - 0.5) * 0.001 // vx
		data[o + 3] = (Math.random() - 0.5) * 0.001 // vy
		data[o + 4] = Math.random() * 0.5 + 0.5 // opacity
	}

	// --- Create particle buffers (ping-pong pair) ---
	const particleBufs = [gl.createBuffer()!, gl.createBuffer()!]
	for (const buf of particleBufs) {
		gl.bindBuffer(gl.ARRAY_BUFFER, buf)
		gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_COPY)
	}

	// --- Helper: set up particle attribute pointers on a VAO ---
	function setupParticleVAO(program: WebGLProgram, buf: WebGLBuffer): WebGLVertexArrayObject {
		const vao = gl.createVertexArray()!
		gl.bindVertexArray(vao)
		gl.bindBuffer(gl.ARRAY_BUFFER, buf)

		const posLoc = gl.getAttribLocation(program, 'a_position')
		const velLoc = gl.getAttribLocation(program, 'a_velocity')
		const opLoc = gl.getAttribLocation(program, 'a_opacity')

		gl.enableVertexAttribArray(posLoc)
		gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, STRIDE, 0)
		gl.enableVertexAttribArray(velLoc)
		gl.vertexAttribPointer(velLoc, 2, gl.FLOAT, false, STRIDE, 8)
		gl.enableVertexAttribArray(opLoc)
		gl.vertexAttribPointer(opLoc, 1, gl.FLOAT, false, STRIDE, 16)

		gl.bindVertexArray(null)
		return vao
	}

	const updateVAOs = particleBufs.map((buf) => setupParticleVAO(updateProg, buf))
	const renderVAOs = particleBufs.map((buf) => setupParticleVAO(renderProg, buf))

	// --- Transform feedback objects (one per output buffer) ---
	const tfs = particleBufs.map((buf) => {
		const tf = gl.createTransformFeedback()!
		gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf)
		gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, buf)
		gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null)
		return tf
	})

	// --- Quad geometry (fullscreen triangle strip) ---
	let quadVAO: WebGLVertexArrayObject | null = null
	let quadBuf: WebGLBuffer | null = null
	if (quadProg) {
		quadBuf = gl.createBuffer()!
		gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf)
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
		quadVAO = gl.createVertexArray()!
		gl.bindVertexArray(quadVAO)
		gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf)
		const loc = gl.getAttribLocation(quadProg, 'a_position')
		gl.enableVertexAttribArray(loc)
		gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
		gl.bindVertexArray(null)
	}

	// --- Trail FBOs (ping-pong pair) ---
	let trailTextures: WebGLTexture[] = []
	let trailFBOs: WebGLFramebuffer[] = []

	function createTrailFBOs(w: number, h: number) {
		for (const t of trailTextures) gl.deleteTexture(t)
		for (const f of trailFBOs) gl.deleteFramebuffer(f)
		trailTextures = []
		trailFBOs = []
		if (!trailsEnabled) return

		for (let i = 0; i < 2; i++) {
			const tex = gl.createTexture()!
			gl.bindTexture(gl.TEXTURE_2D, tex)
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

			const fbo = gl.createFramebuffer()!
			gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
			gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
			gl.clearColor(0, 0, 0, 1)
			gl.clear(gl.COLOR_BUFFER_BIT)

			trailTextures.push(tex)
			trailFBOs.push(fbo)
		}
		gl.bindFramebuffer(gl.FRAMEBUFFER, null)
	}

	createTrailFBOs(width, height)

	// --- State ---
	let curBuf = 0
	let curTrail = 0
	let accentStart = performance.now()
	let accentCenter: [number, number] = [Math.random(), Math.random()]

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
		mouseStrength: gl.getUniformLocation(updateProg, 'u_mouseStrength')
	}
	const uRender = {
		pointSize: gl.getUniformLocation(renderProg, 'u_pointSize'),
		accentPhase: gl.getUniformLocation(renderProg, 'u_accentPhase'),
		accentCenter: gl.getUniformLocation(renderProg, 'u_accentCenter')
	}
	const uQuad = quadProg
		? {
				texture: gl.getUniformLocation(quadProg, 'u_texture'),
				opacity: gl.getUniformLocation(quadProg, 'u_opacity')
			}
		: null

	return {
		draw(uniforms: FrameUniforms) {
			const { time, deltaTime, resolution, mouse } = uniforms
			const next = 1 - curBuf

			// === UPDATE pass (transform feedback) ===
			gl.useProgram(updateProg)
			gl.uniform1f(uUpdate.time, time)
			gl.uniform1f(uUpdate.deltaTime, Math.min(deltaTime, 0.05))
			gl.uniform1f(uUpdate.noiseScale, NOISE_SCALE)
			gl.uniform1f(uUpdate.flowSpeed, FLOW_SPEED)
			gl.uniform1f(uUpdate.flowForce, FLOW_FORCE)
			gl.uniform2f(uUpdate.mouse, mouse[0], mouse[1])
			gl.uniform2f(uUpdate.resolution, resolution[0], resolution[1])
			gl.uniform1f(uUpdate.mouseRadius, MOUSE_RADIUS)
			gl.uniform1f(uUpdate.mouseStrength, MOUSE_STRENGTH)

			gl.bindVertexArray(updateVAOs[curBuf])
			gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tfs[next])

			gl.enable(gl.RASTERIZER_DISCARD)
			gl.beginTransformFeedback(gl.POINTS)
			gl.drawArrays(gl.POINTS, 0, particleCount)
			gl.endTransformFeedback()
			gl.disable(gl.RASTERIZER_DISCARD)

			gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null)
			gl.bindVertexArray(null)

			// === Accent burst timing ===
			const now = performance.now()
			const accentElapsed = now - accentStart
			let accentPhase = 0
			if (accentElapsed < ACCENT_DURATION) {
				accentPhase = accentElapsed / ACCENT_DURATION
			} else if (accentElapsed > ACCENT_INTERVAL) {
				accentStart = now
				accentCenter = [Math.random(), Math.random()]
			}

			// === RENDER pass ===
			const ptSize = POINT_SIZE * (resolution[0] > 768 ? 1.0 : 0.8)

			if (trailsEnabled && quadProg && quadVAO && trailFBOs.length === 2) {
				const nextTrail = 1 - curTrail

				// Draw faded previous frame into FBO[nextTrail]
				gl.bindFramebuffer(gl.FRAMEBUFFER, trailFBOs[nextTrail])
				gl.viewport(0, 0, resolution[0], resolution[1])
				gl.clearColor(0, 0, 0, 1)
				gl.clear(gl.COLOR_BUFFER_BIT)

				gl.useProgram(quadProg)
				gl.uniform1i(uQuad!.texture, 0)
				gl.uniform1f(uQuad!.opacity, TRAIL_FADE)
				gl.activeTexture(gl.TEXTURE0)
				gl.bindTexture(gl.TEXTURE_2D, trailTextures[curTrail])
				gl.bindVertexArray(quadVAO)
				gl.disable(gl.BLEND)
				gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

				// Draw particles on top with additive blending
				gl.useProgram(renderProg)
				gl.uniform1f(uRender.pointSize, ptSize)
				gl.uniform1f(uRender.accentPhase, accentPhase)
				gl.uniform2f(uRender.accentCenter, accentCenter[0], accentCenter[1])
				gl.enable(gl.BLEND)
				gl.blendFunc(gl.SRC_ALPHA, gl.ONE)
				gl.bindVertexArray(renderVAOs[next])
				gl.drawArrays(gl.POINTS, 0, particleCount)

				// Blit FBO to screen
				gl.bindFramebuffer(gl.FRAMEBUFFER, null)
				gl.viewport(0, 0, resolution[0], resolution[1])
				gl.clearColor(0.008, 0.008, 0.008, 1)
				gl.clear(gl.COLOR_BUFFER_BIT)
				gl.useProgram(quadProg)
				gl.uniform1f(uQuad!.opacity, 1.0)
				gl.bindTexture(gl.TEXTURE_2D, trailTextures[nextTrail])
				gl.bindVertexArray(quadVAO)
				gl.disable(gl.BLEND)
				gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

				curTrail = nextTrail
			} else {
				// No trails — render directly to screen
				gl.bindFramebuffer(gl.FRAMEBUFFER, null)
				gl.viewport(0, 0, resolution[0], resolution[1])
				gl.clearColor(0.008, 0.008, 0.008, 1)
				gl.clear(gl.COLOR_BUFFER_BIT)

				gl.useProgram(renderProg)
				gl.uniform1f(uRender.pointSize, ptSize)
				gl.uniform1f(uRender.accentPhase, accentPhase)
				gl.uniform2f(uRender.accentCenter, accentCenter[0], accentCenter[1])
				gl.enable(gl.BLEND)
				gl.blendFunc(gl.SRC_ALPHA, gl.ONE)
				gl.bindVertexArray(renderVAOs[next])
				gl.drawArrays(gl.POINTS, 0, particleCount)
			}

			gl.bindVertexArray(null)
			curBuf = next
		},

		resize(w: number, h: number) {
			createTrailFBOs(w, h)
		},

		destroy() {
			gl.deleteProgram(updateProg)
			gl.deleteProgram(renderProg)
			if (quadProg) gl.deleteProgram(quadProg)
			for (const b of particleBufs) gl.deleteBuffer(b)
			for (const v of [...updateVAOs, ...renderVAOs]) gl.deleteVertexArray(v)
			if (quadVAO) gl.deleteVertexArray(quadVAO)
			if (quadBuf) gl.deleteBuffer(quadBuf)
			for (const tf of tfs) gl.deleteTransformFeedback(tf)
			for (const t of trailTextures) gl.deleteTexture(t)
			for (const f of trailFBOs) gl.deleteFramebuffer(f)
		}
	}
}
