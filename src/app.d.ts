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

        interface MdsvexFile {
            default: import('svelte').Component<any>;
            metadata: Record<string, string>;
        }

        type MdsvexResolver = () => Promise<MdsvexFile>;
    }
}

export {};
