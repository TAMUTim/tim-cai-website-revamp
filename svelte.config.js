import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

import { getHighlighter } from 'shiki';
import {escapeSvelte, mdsvex} from 'mdsvex';

const highlighterCache = new Map();
const shikiThemes = ['ayu-dark'];
const shikiLangs = ['javascript', 'typescript', 'html', 'css'];

/** @type {import('mdsvex').MdsvexOptions} */
const mdsvexOptions = {
	extensions: ['.md'],
	highlight: {
		highlighter: async (code, lang = 'text') => {
			const key = [...shikiLangs, ...shikiLangs].join('-');
			let highlighter = highlighterCache.get(key);

			if(!highlighter) {
				highlighter = await getHighlighter({
					themes: shikiThemes,
					langs: shikiLangs,
				});

				highlighterCache.set(key, highlighter);
			}

			await highlighter.loadLanguage('javascript', 'typescript')
			const html = escapeSvelte(highlighter.codeToHtml(code, { lang, theme: 'ayu-dark' }))
			return `{@html \`${html}\` }`
		}
	}
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
	extensions: ['.svelte', '.md'],

	preprocess:[
		vitePreprocess(),
		mdsvex(mdsvexOptions),
	],

	kit: {
		adapter: adapter()
	}
};

export default config;
