import type {PageServerLoad} from "./$types";

export const load: PageServerLoad = async({ url }) => {
    const module = import.meta.glob('/src/lib/posts/*.md');

    const postPromises = Object.entries(module).map(([path, resolver]) =>
        resolver().then(
            (post) => ({
                slug: path.match(/([\w-]+)\.(svelte\.md|md|svx)/i)?.[1] ?? null,
                ...(post as unknown as App.MdsvexFile).metadata
            } as App.BlogPost)
        )
    );

    const posts = await Promise.all(postPromises);
    const publishedPosts = posts.filter((post) => post.published)

    publishedPosts.sort((a, b) => (new Date(a.date) > new Date(b.date) ? -1 : 1));

    return { posts: publishedPosts };
}