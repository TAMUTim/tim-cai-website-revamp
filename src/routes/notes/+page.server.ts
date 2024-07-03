import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async({ url }) => {
    const module = import.meta.glob('/src/notes/*.md');

    const postPromises = Object.entries(module).map(([path, resolver]) =>
        resolver().then(
            (post) => ({
                slug: path.match(/([\w-]+)\.(svelte\.md|md|svx)/i)?.[1] ?? null,
                ...(post as unknown as App.MdsvexFile).metadata
            } as App.Note)
        )
    );

    const notes = await Promise.all(postPromises);
    const publishedNotes = notes.filter((note) => note.published)

    publishedNotes.sort((a, b) => (a.topic > b.topic ? -1 : 1));

    return { notes: publishedNotes };
}