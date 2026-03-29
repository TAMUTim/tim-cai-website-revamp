import type { PageServerLoad } from "./$types";
import { loadMarkdownContent } from "$lib/utils";
import { NoteSchema } from "$lib/schemas";
import type { Note } from "$lib/schemas";

export const load: PageServerLoad = async () => {
    const glob = import.meta.glob('/src/notes/*.md');
    const notes = await loadMarkdownContent<Note>(glob, NoteSchema);

    const publishedNotes = notes
        .filter((note) => note.published)
        .sort((a, b) => (a.topic > b.topic ? -1 : 1));

    return { notes: publishedNotes };
};
