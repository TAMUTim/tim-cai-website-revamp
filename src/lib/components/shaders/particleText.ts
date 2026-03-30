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
