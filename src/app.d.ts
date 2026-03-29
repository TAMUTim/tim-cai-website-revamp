import '$lib/styles/main.css';

declare global {
    namespace App {
        type BlogPost = import('$lib/schemas').BlogPost;
        type Note = import('$lib/schemas').Note;

        interface PostYear {
            year: number;
            posts: BlogPost[];
        }

        interface NoteYear {
            topic: string;
            notes: Note[];
        }

    }
}

export {};
