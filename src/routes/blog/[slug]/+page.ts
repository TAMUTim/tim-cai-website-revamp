import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageLoad = async ({ params }) => {
    const modules = import.meta.glob('/src/posts/*.svx');

    let match: { path?: string; resolver?: App.MdsvexResolver } = {};
    for (const [path, resolver] of Object.entries(modules)) {
        if((path.match(/([\w-]+)\.(svelte\.md|md|svx)/i)?.[1] ?? null) === params.slug) {
            match = { path, resolver: resolver as unknown as App.MdsvexResolver };
            break;
        }
    }

    const post = await match?.resolver?.();

    if(!post || !post.metadata.published) {
        throw error(404);
    }

    return {
        component: post.default,
        frontmatter: post.metadata
    }
}