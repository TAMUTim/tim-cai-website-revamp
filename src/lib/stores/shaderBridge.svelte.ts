import type { FrameUniforms } from '$lib/components/shaders/webgl';

export interface ShaderOverlay {
	draw(gl: WebGL2RenderingContext, uniforms: FrameUniforms): void;
	destroy(): void;
}

let glContext = $state<WebGL2RenderingContext | null>(null);
let currentOverlay = $state<ShaderOverlay | null>(null);
let topOffset = $state(0);

export const shaderBridge = {
	get gl() { return glContext; },
	set gl(v: WebGL2RenderingContext | null) { glContext = v; },
	get overlay() { return currentOverlay; },
	set overlay(v: ShaderOverlay | null) { currentOverlay = v; },
	get canvasTop() { return topOffset; },
	set canvasTop(v: number) { topOffset = v; },
};
