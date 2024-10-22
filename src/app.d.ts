import '$lib/styles/main.css'

// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}

		interface MdsvexFile {
			default: import('svelte/internal').SvelteComponent
			metadata: Record<string, string>
		}

		type MdsvexResolver = () => Promise<MdsvexFile>

		interface BlogPost {
			title: string
			slug: string
			author: string
			date: string
			published: boolean
			readTime: number
		}

		interface PostYear {
			year: number
			posts: BlogPost[]
		}

		interface Note {
			title: string
			slug: string
			author: string
			date: string
			published: boolean
			readTime: number
			topic: string
		}

		interface NoteYear {
			topic: string
			notes: Note[]
		}
	}
}

export {}
