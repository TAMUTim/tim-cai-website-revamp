# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Start Vite dev server
- `npm run build` — Production build
- `npm run preview` — Preview production build
- `npm run check` — Type check with svelte-check
- `npm run check:watch` — Type check in watch mode

No test framework is configured.

## Architecture

SvelteKit personal website with file-based markdown content, WebGL2 background animations, and Tailwind CSS styling.

### Content System

Blog posts live in `src/lib/posts/*.md` and notes in `src/lib/notes/*.md`. Both use YAML frontmatter with a `published` boolean for filtering. Notes have an additional `topic` field for grouping. Content is loaded server-side via `import.meta.glob()` in `+page.server.ts` files.

### Routing

- `/blog/[slug]` and `/notes/[slug]` — dynamic content routes
- `/projects` — static page

### Key Components

- `src/lib/components/ShaderBackground.svelte` — reusable WebGL2 background wrapper (shader-agnostic)
- `src/lib/components/shaders/flowField.ts` — GPU flow field particle shader (transform feedback, trails, accent bursts)
- `src/lib/components/shaders/webgl.ts` — shared WebGL2 types and utilities
- `src/routes/+layout.svelte` — global layout with nav, footer, scroll button, and shader background
- `src/lib/stores/animatedSections.js` — writable store tracking animated section count

### Styling

Dark theme with CSS variables in `src/lib/styles/main.css`. Custom stagger animation system using `data-animate` attributes. Tailwind config extends with custom fonts (IBM Plex Sans/Mono, Nabla) and prose styling via typography plugin.

### Preprocessing

mdsvex compiles Markdown to Svelte components with Shiki syntax highlighting (`ayu-dark` theme). Configured in `svelte.config.js`.

## Conventions

- Tabs, single quotes, 100 char print width (Prettier)
- Global types defined in `src/app.d.ts` (BlogPost, Note, MdsvexFile interfaces)
- Strict TypeScript with `checkJs` enabled
