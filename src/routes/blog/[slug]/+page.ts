import type { PageLoad } from './$types';
import { resolveContentBySlug } from '$lib/utils';

export const load: PageLoad = async ({ params }) => {
    const glob = import.meta.glob('/src/lib/posts/*.md');
    return resolveContentBySlug(glob, params.slug);
};
