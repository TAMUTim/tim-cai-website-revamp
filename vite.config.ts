import { sveltekit } from '@sveltejs/kit/vite';
import {defineConfig, searchForWorkspaceRoot} from 'vite';

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
