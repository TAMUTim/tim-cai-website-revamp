# Modernize + Polish: Design Spec

Personal website modernization — upgrade to Svelte 5, improve code quality, add SEO basics, and harden the content pipeline. Visual refresh deferred to a future phase.

## Scope

- Svelte 4 → 5 migration (runes, new event syntax, state management)
- Dependency cleanup and upgrades (including replacing `p5-svelte` with raw `p5`, upgrading `mdsvex` for Svelte 5 compat)
- Code quality, type safety, and content pipeline hardening (merged — utilities are extracted with Zod validation from the start)
- Basic SEO and accessibility

Explicitly **out of scope**: Tailwind v4 migration, Dots visual redesign (p5 logic stays as-is, only the wrapper changes), JSON-LD, sitemap, OG image generation, full WCAG audit.

## Layers Overview

1. **Dependency Cleanup & Upgrades** — remove dead deps, upgrade for Svelte 5 compat, swap p5-svelte for raw p5
2. **Svelte 5 Migration** — runes, new event syntax, store → state
3. **Code Quality, Type Safety & Content Pipeline** — fix bugs, remove dead code, extract validated utilities with Zod
4. **SEO & Accessibility** — meta/OG tags, aria labels, skip-to-content

## Layer 1: Dependency Cleanup & Upgrades

**Remove:**
- `svelte-meta-tags` — installed but never imported anywhere
- `p5-svelte` — unmaintained (last commit 2022), incompatible with Svelte 5. Replace with raw `p5` in instance mode in `Dots.svelte` (contained change, same visual result)

**Upgrade:**
| Package | From | To | Notes |
|---------|------|----|-------|
| `svelte` | ^4.2.7 | ^5.0.0 | Major — runes migration in Layer 2 |
| `@sveltejs/kit` | ^2.0.0 | latest ^2.x | Minor compatible upgrades |
| `@sveltejs/vite-plugin-svelte` | ^3.0.0 | ^5.0.0 | Required for Svelte 5 |
| `svelte-check` | ^3.6.0 | ^4.0.0 | Required for Svelte 5 |
| `vite` | ^5.0.3 | ^6.0.0 | Latest major |
| `typescript` | ^5.0.0 | ^5.7.0 | Latest 5.x |
| `@sveltejs/adapter-auto` | ^3.0.0 | latest ^3.x | Minor updates |
| `mdsvex` | ^0.11.2 | ^0.12.7 | Required for Svelte 5 compatibility |

**Keep as-is:** `nprogress`, `tailwindcss` (v3).

**Compatibility note:** `p5-svelte@3` and `mdsvex@0.11` are both incompatible with Svelte 5. The upgrades/replacements above address this. Verify both work after the upgrade before proceeding to Layer 2.

**Verification:**
1. `npm install` completes without errors
2. `npm run build` succeeds
3. `npm run check` passes (Svelte 5 deprecation warnings expected)
4. Dev server starts and site renders
5. Dots background animation still renders correctly (p5-svelte → raw p5 swap)
6. Blog/notes markdown content still loads (mdsvex upgrade)

## Layer 2: Svelte 5 Migration

### Syntax changes across all components

| Svelte 4 | Svelte 5 | Files |
|----------|----------|-------|
| `export let data` | `let { data } = $props()` | All +page.svelte, +layout.svelte, +error.svelte |
| `$: derived = ...` | `let derived = $derived(...)` | +layout.svelte, blog/[slug], notes/[slug] |
| `$: { sideEffect() }` | `$effect(() => { ... })` | +layout.svelte (NProgress) |
| `store.subscribe(cb)` | `$state` + direct import | +layout.svelte, animatedSections |
| `on:click={handler}` | `onclick={handler}` | All components with events |
| `$$Generic` type param | `generics` attribute | notes/[slug]/+page.svelte |

### Store → State migration

Replace `src/lib/stores/animatedSections.js` (writable store) with `src/lib/stores/animatedSections.svelte.ts` using `$state` rune. This also fixes the existing memory leak where `+layout.svelte` subscribes without cleanup.

### Component-by-component scope

- **+layout.svelte** — heaviest: props, NProgress effect, store subscription, renderDots derived, event handlers
- **+page.svelte (home)** — props only
- **blog/+page.svelte** — props, remove unused `currentPath`
- **blog/[slug]/+page.svelte** — props, derived component
- **notes/+page.svelte** — props, remove unused `currentPath`
- **notes/[slug]/+page.svelte** — props, derived component, remove `$$Generic`
- **+error.svelte** — props, remove unused `title` export
- **projects/+page.svelte** — minimal (mostly static)
- **hundred/+page.svelte** — props
- **Dots.svelte** — props only (p5 sketch logic stays imperative — we are migrating Svelte reactivity, not p5 internals)
- **HundredShowcase.svelte** — props, event handlers
- **animatedSections.js → .svelte.ts** — writable store → $state rune

**Verification:**
1. `npm run check` — zero errors, no Svelte 4 deprecation warnings
2. `npm run build` — successful production build
3. Manual: navigate all routes, check NProgress fires, dots render, blog posts load, notes group correctly
4. Grep: no `$:` reactive declarations remain in any `.svelte` file (p5 callback internals are imperative, not Svelte reactivity)

## Layer 3: Code Quality, Type Safety & Content Pipeline

### Bug fixes

- **Slug extraction returns null** — `blog/+page.server.ts` and `notes/+page.server.ts` use regex that can return `null`, but the type says `string`. Add filtering to remove null slugs.
- **Store subscription leak** — verify resolved by Layer 2's `$state` migration.

### Dead code removal

- `blog/+page.svelte` — unused `currentPath` variable
- `notes/+page.svelte` — unused `currentPath` variable
- `+error.svelte` — unused `title` export (removed in Layer 2)
- `svelte.config.js` — redundant `highlighter.loadLanguage()` call

### Type safety

- Replace `any` types in `Dots.svelte` (`canvas: any`, `p5: any`) with `HTMLCanvasElement` and `P5` from `@types/p5`
- Replace `as unknown as` casts in content loading with properly typed helper functions
- Remove `$$Generic` usage (handled in Layer 2)

### Extract shared utilities with Zod validation

**New dependency:** `zod`

Define frontmatter schemas:

```typescript
const BlogPostSchema = z.object({
  title: z.string(),
  slug: z.string(),
  date: z.string(),
  author: z.string(),
  published: z.boolean(),
  readTime: z.number()
});

const NoteSchema = z.object({
  title: z.string(),
  slug: z.string(),
  date: z.string(),
  author: z.string(),
  published: z.boolean(),
  topic: z.string()
});
```

Extract shared utilities to `src/lib/utils.ts` with validation built in from the start:

1. **`extractSlug(path: string): string | null`** — slug regex appears 3 times, consolidate
2. **`loadMarkdownContent(glob, schema)`** — accepts Zod schema, validates each entry. Logs warnings for invalid frontmatter in dev, filters silently in prod. Replaces the identical glob+filter+sort pattern in blog and notes server loads.
3. **`resolveContentBySlug(glob, slug)`** — returns proper 404 via SvelteKit's `error()` if slug not found. Replaces the identical pattern in blog/[slug] and notes/[slug] page loads.

### Type definitions

- Derive TypeScript types from Zod schemas via `z.infer<typeof BlogPostSchema>` in `app.d.ts`
- Remove manual interface definitions that duplicate what Zod defines

**Verification:**
1. `npm run check` — zero errors, no `any` in our code (p5 internals excluded)
2. `npm run build` — clean build
3. Grep for `as unknown` — zero occurrences
4. Grep for slug regex — only in `utils.ts`
5. Break a frontmatter field intentionally → clear error in dev
6. Access non-existent slug → proper 404 page
7. All existing blog posts and notes load correctly

## Layer 4: SEO & Accessibility

### Meta tags (via `<svelte:head>`)

- **Layout-level defaults** in `+layout.svelte`: `description`, `og:title`, `og:description`, `og:url`, `canonical`. Individual pages override.
- **Blog posts** get additional: `og:type=article`, `article:published_time`, `article:author` from frontmatter.
- **No OG images** — deferred to visual refresh.

### Accessibility

- **Skip-to-content link** at top of `+layout.svelte`
- **`aria-label`** on icon-only nav links (GitHub, resume download)
- **`aria-label="Scroll to top"`** on scroll button
- **Focus styling** on error page button

### Out of scope

- JSON-LD structured data
- sitemap.xml generation
- OG image generation
- Full WCAG audit / color contrast fixes

**Verification:**
1. View page source on each route — meta tags present
2. Test social sharing preview with opengraph.xyz or similar
3. Keyboard-only navigation: Tab through all pages, verify skip link works
4. `npm run build` — clean build
