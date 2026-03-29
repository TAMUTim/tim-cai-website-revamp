import type { PageServerLoad } from "./$types";
import { loadMarkdownContent } from "$lib/utils";
import { BlogPostSchema } from "$lib/schemas";
import type { BlogPost } from "$lib/schemas";

export const load: PageServerLoad = async () => {
    const glob = import.meta.glob('/src/lib/posts/*.md');
    const posts = await loadMarkdownContent<BlogPost>(glob, BlogPostSchema);

    const publishedPosts = posts
        .filter((post) => post.published)
        .sort((a, b) => (new Date(a.date) > new Date(b.date) ? -1 : 1));

    return { posts: publishedPosts };
};
