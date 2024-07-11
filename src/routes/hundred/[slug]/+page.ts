import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageLoad = async ({ params }) => {
	const hundredComponent = (await import(`../../../lib/hundred/${params.slug}.svelte`));

	if(!hundredComponent) {
		throw error(404);
	}

	return {
		component: hundredComponent.default
	}
}