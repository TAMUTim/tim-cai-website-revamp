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
