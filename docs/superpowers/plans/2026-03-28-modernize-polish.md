# Modernize + Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize a SvelteKit personal website from Svelte 4 to Svelte 5, fix code quality issues, add SEO/accessibility basics, and harden the content pipeline with Zod validation.

**Architecture:** 4-layer migration executed sequentially. Each layer produces a buildable, verifiable state. Layer 1 upgrades dependencies (including swapping p5-svelte for raw p5). Layer 2 migrates all Svelte syntax to runes. Layer 3 extracts shared utilities with Zod validation and fixes type safety. Layer 4 adds SEO meta tags and accessibility improvements.

**Tech Stack:** SvelteKit 2, Svelte 5, Vite 6, TypeScript 5.7, Tailwind CSS 3, mdsvex 0.12, p5.js (raw), Zod

**Important paths:**
- Blog posts: `src/lib/posts/*.md`
- Notes: `src/notes/*.md` (NOT under `src/lib/`)
- Hundred components: `src/lib/hundred/*.svelte`

**No test framework is configured.** Verification uses `npm run check` (svelte-check + TypeScript) and `npm run build` as automated gates, plus manual smoke tests.

---

## Layer 1: Dependency Cleanup & Upgrades

### Task 1: Remove unused dependencies and install replacements

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Remove `svelte-meta-tags` and `p5-svelte`, add `p5` as direct dependency**

```bash
npm uninstall svelte-meta-tags p5-svelte
npm install p5
```

`svelte-meta-tags` is installed but never imported. `p5-svelte` is unmaintained and incompatible with Svelte 5 — we replace it with raw `p5` (instance mode). `@types/p5` is already in devDependencies.

- [ ] **Step 2: Verify the removals**

Run: `grep -r "svelte-meta-tags\|p5-svelte" src/`
Expected: No matches (these packages are not imported anywhere except `Dots.svelte` which imports `p5-svelte`)

The only import of `p5-svelte` is in `src/lib/components/Dots.svelte` — we'll rewrite that in Task 2.

### Task 2: Rewrite Dots.svelte to use raw p5

**Files:**
- Modify: `src/lib/components/Dots.svelte`

- [ ] **Step 1: Rewrite Dots.svelte to use p5 in instance mode**

Replace the entire contents of `src/lib/components/Dots.svelte` with:

```svelte
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import p5 from 'p5';

    let container: HTMLDivElement;
    let p5Instance: p5;

    const SCALE = 300;
    const LENGTH = 12;
    const SPACING = 20;

    onMount(() => {
        const body = document.body;
        const html = document.documentElement;

        let w = window.innerWidth;
        let h = Math.max(
            body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight
        );

        const offsetY = window.scrollY;

        const existingPoints = new Set<string>();
        const points: { x: number; y: number; opacity: number }[] = [];

        function addPoints() {
            for (let x = -SPACING / 2; x < w + SPACING; x += SPACING) {
                for (let y = -SPACING / 2; y < h + offsetY + SPACING; y += SPACING) {
                    const id = `${x}-${y}`;
                    if (existingPoints.has(id)) continue;
                    existingPoints.add(id);
                    points.push({ x, y, opacity: Math.random() * 0.5 + 0.5 });
                }
            }
        }

        function getForceOnPoint(sketch: p5, x: number, y: number, z: number) {
            return (sketch.noise(x / SCALE, y / SCALE, z) - 0.5) * 2 * sketch.TWO_PI;
        }

        p5Instance = new p5((sketch: p5) => {
            sketch.setup = () => {
                sketch.createCanvas(w, h);
                sketch.background('#FFFFFF');
                sketch.stroke('#ccc');
                sketch.noFill();
                sketch.colorMode(sketch.HSL, 360, 100, 100, 255);
                sketch.noiseSeed(+new Date());
                addPoints();
            };

            sketch.draw = () => {
                sketch.background('#ffffff');
                const t = +new Date() / 10000;

                for (const p of points) {
                    const { x, y } = p;
                    const rad = getForceOnPoint(sketch, x, y, t);
                    const cosRad = sketch.cos(rad);
                    const length = (sketch.noise(x / SCALE, y / SCALE, t * 2) + 0.5) * LENGTH;
                    const nx = x + cosRad * length;
                    const ny = y + sketch.sin(rad) * length;
                    const hue = (t * 100 + x + y) % 360;

                    sketch.stroke(hue, 80, 50, (Math.abs(cosRad) * 0.8 + 0.2) * p.opacity * 255);
                    sketch.circle(nx, ny - offsetY, 1);
                }
            };

            sketch.windowResized = () => {
                w = window.outerWidth;
                h = Math.max(
                    document.body.scrollHeight, document.body.offsetHeight,
                    document.documentElement.clientHeight, document.documentElement.scrollHeight,
                    document.documentElement.offsetHeight
                );
                sketch.resizeCanvas(w, h);
                addPoints();
            };
        }, container);
    });

    onDestroy(() => {
        if (p5Instance) {
            p5Instance.remove();
        }
    });
</script>

<div class="absolute bg-fixed pointer-events-none invert" bind:this={container}></div>
```

Key changes from original:
- `import p5 from 'p5'` instead of `import P5 from 'p5-svelte'`
- Uses `onMount` + `new p5(sketch, container)` instance mode
- Uses `onDestroy` for cleanup (prevents memory leaks)
- Resize handler uses p5's built-in `sketch.windowResized` instead of manual `addEventListener`
- All `any` types replaced with `p5` type
- No more direct `document.body` access at module level (moved into `onMount`)

- [ ] **Step 2: Verify the Dots component renders**

Run: `npm run check`
Expected: No type errors related to Dots.svelte

Run: `npm run dev` and open the site
Expected: Rainbow dot animation renders on the home page, same as before

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/Dots.svelte package.json package-lock.json
git commit -m "Replace p5-svelte with raw p5 instance mode

p5-svelte is unmaintained (last commit 2022) and incompatible with
Svelte 5. Rewrite Dots.svelte to use p5 directly in instance mode
with proper cleanup via onDestroy."
```

### Task 3: Upgrade all dependencies for Svelte 5 compatibility

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Upgrade packages**

```bash
npm install -D svelte@^5.0.0 @sveltejs/vite-plugin-svelte@^5.0.0 svelte-check@^4.0.0 vite@^6.0.0 typescript@^5.7.0 mdsvex@^0.12.7
npm install -D @sveltejs/kit@latest @sveltejs/adapter-auto@latest
```

- [ ] **Step 2: Verify the build still works**

Run: `npm run build`
Expected: Build succeeds. There may be Svelte 4 deprecation warnings (e.g., `export let` usage) — these are expected and will be resolved in Layer 2.

Run: `npm run check`
Expected: May show deprecation warnings but no hard errors.

- [ ] **Step 3: Verify the site still works**

Run: `npm run dev` and open the site
Expected: All pages load, dots render, blog posts display, notes display, NProgress fires on navigation.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "Upgrade to Svelte 5, Vite 6, mdsvex 0.12, TS 5.7

Svelte 4 legacy syntax still in use — migration to runes in next step."
```

---

## Layer 2: Svelte 5 Migration

### Task 4: Migrate animatedSections store to $state

**Files:**
- Delete: `src/lib/stores/animatedSections.js`
- Create: `src/lib/stores/animatedSections.svelte.ts`

- [ ] **Step 1: Create the new state module**

Create `src/lib/stores/animatedSections.svelte.ts`:

```typescript
let count = $state(0);

export const animatedSections = {
    get count() { return count; },
    set(value: number) { count = value; }
};
```

The `.svelte.ts` extension enables runes in `.ts` files. The getter ensures reactive reads, and `set()` provides the same API shape consumers expect.

- [ ] **Step 2: Delete the old store file**

```bash
rm src/lib/stores/animatedSections.js
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/stores/animatedSections.svelte.ts
git add -u src/lib/stores/animatedSections.js
git commit -m "Migrate animatedSections from writable store to \$state rune"
```

### Task 5: Migrate +layout.svelte to Svelte 5

**Files:**
- Modify: `src/routes/+layout.svelte`

- [ ] **Step 1: Rewrite the script block**

Replace the entire `<script lang="ts">` block in `src/routes/+layout.svelte` with:

```svelte
<script lang="ts">
    import '$lib/styles/main.css'
    import '@fortawesome/fontawesome-free/css/all.min.css'
    import { browser } from "$app/environment";
    import { navigating, page } from '$app/stores';
    import { animatedSections } from '$lib/stores/animatedSections.svelte';

    import NProgress from 'nprogress';

    import Dots from '$lib/components/Dots.svelte';

    // Assets
    import GoobImage from '$lib/assets/goob.png';
    import Resume from '$lib/assets/tim_cai_resume.pdf';
    import GoobFavicon from '$lib/assets/favicons/favicon.ico';

    let { children } = $props();

    $effect(() => {
        if ($navigating) {
            NProgress.start();
        } else {
            NProgress.done();
        }
    });

    function scrollToTop() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    let y: number = $state(0);

    let renderDots = $derived(!($page.url.pathname.includes('blog/') || $page.url.pathname.includes('notes/')));
</script>
```

- [ ] **Step 2: Update the template**

In the same file, replace `<slot />` with `{@render children()}`.

Replace the scroll button:
```svelte
<button
        title="Scroll to the top"
        class="fixed right-3 bottom-3 w-10 h-10 rounded-full z-100 print:hidden text-slate-200 {y > 10 ? 'opacity-100' : 'opacity-0'}"
        onclick={scrollToTop}
>
    <i class="fa-solid fa-arrow-up"></i>
</button>
```

Replace the footer stagger style to use `animatedSections.count`:
```svelte
        <div class="mt-10 mb-6 w-content" style="--stagger: {animatedSections.count + 1}" data-animate>
```

- [ ] **Step 3: Verify**

Run: `npm run check`
Expected: No errors for `+layout.svelte`

- [ ] **Step 4: Commit**

```bash
git add src/routes/+layout.svelte
git commit -m "Migrate +layout.svelte to Svelte 5 runes

Replace \$: with \$derived/\$effect, export let with \$props,
on:click with onclick, slot with @render, store subscription
with direct \$state read."
```

### Task 6: Migrate home page and error page

**Files:**
- Modify: `src/routes/+page.svelte`
- Modify: `src/routes/+error.svelte`

- [ ] **Step 1: Rewrite +page.svelte (home) script block**

Replace the `<script>` block in `src/routes/+page.svelte` with:

```svelte
<script>
    import { animatedSections } from '$lib/stores/animatedSections.svelte';

    let title = "Tim Cai";

    animatedSections.set(3);
</script>
```

Note: `title` is no longer an `export let` prop — it was only used internally for `<svelte:head>`.

- [ ] **Step 2: Rewrite +error.svelte script block**

Replace the `<script>` block in `src/routes/+error.svelte` with:

```svelte
<script>
    import { animatedSections } from '$lib/stores/animatedSections.svelte';

    let title = "Error - Tim Cai";

    animatedSections.set(2);

    function goBack() {
        history.back();
    }
</script>
```

In the template, replace `on:click={goBack}` with `onclick={goBack}`.

- [ ] **Step 3: Verify**

Run: `npm run check`
Expected: No errors for these files

- [ ] **Step 4: Commit**

```bash
git add src/routes/+page.svelte src/routes/+error.svelte
git commit -m "Migrate home page and error page to Svelte 5"
```

### Task 7: Migrate blog pages

**Files:**
- Modify: `src/routes/blog/+page.svelte`
- Modify: `src/routes/blog/[slug]/+page.svelte`

- [ ] **Step 1: Rewrite blog/+page.svelte script block**

Replace the `<script lang="ts">` block in `src/routes/blog/+page.svelte` with:

```svelte
<script lang="ts">
    import { getFormattedDate } from "$lib/utils";
    import { page } from '$app/stores';
    import type { PageData } from './$types';
    import { animatedSections } from '$lib/stores/animatedSections.svelte';

    animatedSections.set(3);

    let { data }: { data: PageData } = $props();
    let title = "Blog - Tim Cai";

    let postsByYear: App.PostYear[] = [
        {
            year: new Date().getFullYear(),
            posts: []
        }
    ];

    for(const post of data.posts) {
        if(postsByYear[postsByYear.length - 1].year !== new Date(post.date).getFullYear()) {
            let newYearObj: App.PostYear = {
                year: new Date(post.date).getFullYear(),
                posts: [post]
            }

            postsByYear.push(newYearObj);
        } else {
            postsByYear[postsByYear.length - 1].posts.push(post);
        }
    }
</script>
```

In the template, replace the `currentPath` references with inline `$page.url.pathname`:
```svelte
        <a href="/blog" class={$page.url.pathname === '/blog' ? 'active' : 'inactive'}>
```
```svelte
        <a href="/notes" class={$page.url.pathname === '/notes' ? 'active' : 'inactive'}>
```

- [ ] **Step 2: Rewrite blog/[slug]/+page.svelte**

Replace the entire contents of `src/routes/blog/[slug]/+page.svelte` with:

```svelte
<svelte:head>
    <title>{data.frontmatter.title}</title>
</svelte:head>

<script lang="ts">
    import { getFormattedDate } from '$lib/utils';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();
    let component = $derived(data.component);
</script>

<div class="flex flex-col items-center justify-center font-ibm mt-10">
    <div class="w-content" style="--stagger: 1" data-animate>
        <p class="text-4xl text-slate-300 font-nabla font-semibold">{ data.frontmatter.title }</p>
        <p class="mt-4 text-slate-400 text-2xl">{ getFormattedDate(data.frontmatter.date) } · { data.frontmatter.readTime } min</p>
    </div>

    <div class="w-content text-slate-300 mt-8 prose prose-content" style="--stagger: 2" data-animate>
        <svelte:component this={component} />
    </div>
</div>
```

- [ ] **Step 3: Verify**

Run: `npm run check`
Expected: No errors for blog pages

- [ ] **Step 4: Commit**

```bash
git add src/routes/blog/+page.svelte src/routes/blog/[slug]/+page.svelte
git commit -m "Migrate blog pages to Svelte 5 runes"
```

### Task 8: Migrate notes pages

**Files:**
- Modify: `src/routes/notes/+page.svelte`
- Modify: `src/routes/notes/[slug]/+page.svelte`

- [ ] **Step 1: Rewrite notes/+page.svelte script block**

Replace the `<script lang="ts">` block in `src/routes/notes/+page.svelte` with:

```svelte
<script lang="ts">
    import { getFormattedDate } from "$lib/utils";
    import { page } from '$app/stores';
    import type { PageData } from './$types'
    import { animatedSections } from '$lib/stores/animatedSections.svelte';

    animatedSections.set(3);

    let { data }: { data: PageData } = $props();
    let title = "Notes - Tim Cai";

    let notesByYear: App.NoteYear[] = [];

    for(const post of data.notes) {
        if(notesByYear.length === 0 || (notesByYear[notesByYear.length - 1].topic !== post.topic)) {
            notesByYear.push(
                {
                    topic: post.topic,
                    notes: [post]
                }
            );
        } else {
            notesByYear[notesByYear.length - 1].notes.push(post);
        }
    }
</script>
```

In the template, replace `currentPath` references with inline `$page.url.pathname` (same pattern as blog).

- [ ] **Step 2: Rewrite notes/[slug]/+page.svelte**

Replace the entire contents of `src/routes/notes/[slug]/+page.svelte` with:

```svelte
<svelte:head>
    <title>{data.frontmatter.title}</title>
</svelte:head>

<script lang="ts">
    import { getFormattedDate } from '$lib/utils';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();
    let component = $derived(data.component);
</script>

<div class="flex flex-col items-center justify-center font-ibm mt-10">
    <div class="w-content" style="--stagger: 1" data-animate>
        <p class="text-4xl text-slate-300 font-semibold">{ data.frontmatter.title }</p>
        <p class="mt-4 text-slate-400 text-2xl">{ getFormattedDate(data.frontmatter.date) } · { data.frontmatter.readTime } min</p>
    </div>

    <div class="w-content text-slate-300 text-lg mt-10" style="--stagger: 2" data-animate>
        <svelte:component this={component} />
    </div>
</div>
```

- [ ] **Step 3: Verify**

Run: `npm run check`
Expected: No errors for notes pages

- [ ] **Step 4: Commit**

```bash
git add src/routes/notes/+page.svelte src/routes/notes/[slug]/+page.svelte
git commit -m "Migrate notes pages to Svelte 5 runes"
```

### Task 9: Migrate hundred pages and remaining components

**Files:**
- Modify: `src/routes/hundred/+page.svelte`
- Modify: `src/lib/components/Dots.svelte`

- [ ] **Step 1: Rewrite hundred/+page.svelte script block**

Replace the `<script lang="ts">` block in `src/routes/hundred/+page.svelte` with:

```svelte
<script lang="ts">
    import { animatedSections } from '$lib/stores/animatedSections.svelte';

    animatedSections.set(2);

    let { data }: { data: any } = $props();
    let pageTitle = "100 - Tim Cai";

    const titles = data.titles;
</script>
```

- [ ] **Step 2: Migrate Dots.svelte to Svelte 5**

In `src/lib/components/Dots.svelte`, replace `onMount`/`onDestroy` with `$effect`:

```svelte
<script lang="ts">
    import p5 from 'p5';

    let container: HTMLDivElement;

    const SCALE = 300;
    const LENGTH = 12;
    const SPACING = 20;

    $effect(() => {
        const body = document.body;
        const html = document.documentElement;

        let w = window.innerWidth;
        let h = Math.max(
            body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight
        );

        const offsetY = window.scrollY;

        const existingPoints = new Set<string>();
        const points: { x: number; y: number; opacity: number }[] = [];

        function addPoints() {
            for (let x = -SPACING / 2; x < w + SPACING; x += SPACING) {
                for (let y = -SPACING / 2; y < h + offsetY + SPACING; y += SPACING) {
                    const id = `${x}-${y}`;
                    if (existingPoints.has(id)) continue;
                    existingPoints.add(id);
                    points.push({ x, y, opacity: Math.random() * 0.5 + 0.5 });
                }
            }
        }

        function getForceOnPoint(sketch: p5, x: number, y: number, z: number) {
            return (sketch.noise(x / SCALE, y / SCALE, z) - 0.5) * 2 * sketch.TWO_PI;
        }

        const instance = new p5((sketch: p5) => {
            sketch.setup = () => {
                sketch.createCanvas(w, h);
                sketch.background('#FFFFFF');
                sketch.stroke('#ccc');
                sketch.noFill();
                sketch.colorMode(sketch.HSL, 360, 100, 100, 255);
                sketch.noiseSeed(+new Date());
                addPoints();
            };

            sketch.draw = () => {
                sketch.background('#ffffff');
                const t = +new Date() / 10000;

                for (const p of points) {
                    const { x, y } = p;
                    const rad = getForceOnPoint(sketch, x, y, t);
                    const cosRad = sketch.cos(rad);
                    const length = (sketch.noise(x / SCALE, y / SCALE, t * 2) + 0.5) * LENGTH;
                    const nx = x + cosRad * length;
                    const ny = y + sketch.sin(rad) * length;
                    const hue = (t * 100 + x + y) % 360;

                    sketch.stroke(hue, 80, 50, (Math.abs(cosRad) * 0.8 + 0.2) * p.opacity * 255);
                    sketch.circle(nx, ny - offsetY, 1);
                }
            };

            sketch.windowResized = () => {
                w = window.outerWidth;
                h = Math.max(
                    document.body.scrollHeight, document.body.offsetHeight,
                    document.documentElement.clientHeight, document.documentElement.scrollHeight,
                    document.documentElement.offsetHeight
                );
                sketch.resizeCanvas(w, h);
                addPoints();
            };
        }, container);

        return () => {
            instance.remove();
        };
    });
</script>

<div class="absolute bg-fixed pointer-events-none invert" bind:this={container}></div>
```

The `$effect` return function handles cleanup (replaces `onDestroy`).

- [ ] **Step 3: Verify full Layer 2**

Run: `npm run check`
Expected: Zero errors, no Svelte 4 deprecation warnings

Run: `npm run build`
Expected: Clean production build

Run: `grep -r '\$:' src/ --include='*.svelte'`
Expected: No matches — all reactive declarations migrated

Run: `grep -r 'on:click\|on:submit\|on:keydown' src/ --include='*.svelte'`
Expected: No matches — all event handlers migrated

Run: `grep -r 'export let' src/ --include='*.svelte'`
Expected: No matches — all props migrated

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev` and verify:
- Home page loads with dots animation
- Navigate to `/blog` — NProgress bar fires, blog listing renders
- Click a blog post — content renders with formatted date
- Navigate to `/notes` — notes grouped by topic
- Navigate to `/hundred` — titles listed
- Navigate to `/projects` — under construction page
- Navigate to a non-existent URL — error page renders, "way back" button works
- Scroll down — scroll-to-top button appears and works

- [ ] **Step 5: Commit**

```bash
git add src/routes/hundred/+page.svelte src/lib/components/Dots.svelte
git commit -m "Complete Svelte 5 migration: hundred page and Dots component

All components now use \$props, \$derived, \$effect, onclick.
No Svelte 4 legacy syntax remains."
```

---

## Layer 3: Code Quality, Type Safety & Content Pipeline

### Task 10: Install Zod and create content schemas

**Files:**
- Modify: `package.json`
- Create: `src/lib/schemas.ts`

- [ ] **Step 1: Install Zod**

```bash
npm install zod
```

- [ ] **Step 2: Create content schemas**

Create `src/lib/schemas.ts`:

```typescript
import { z } from 'zod';

export const BlogPostSchema = z.object({
    title: z.string(),
    slug: z.string(),
    date: z.string(),
    author: z.string(),
    published: z.boolean(),
    readTime: z.number()
});

export const NoteSchema = z.object({
    title: z.string(),
    slug: z.string(),
    date: z.string(),
    author: z.string(),
    published: z.boolean(),
    readTime: z.number(),
    topic: z.string()
});

export type BlogPost = z.infer<typeof BlogPostSchema>;
export type Note = z.infer<typeof NoteSchema>;
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json src/lib/schemas.ts
git commit -m "Add Zod schemas for blog post and note frontmatter"
```

### Task 11: Extract shared content utilities

**Files:**
- Modify: `src/lib/utils.ts`

- [ ] **Step 1: Add content loading utilities to utils.ts**

Replace the entire contents of `src/lib/utils.ts` with:

```typescript
import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { z } from 'zod';

export const getFormattedDate = (dateString: string) => {
    const dateObj = new Date(dateString);
    return dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });
};

export function extractSlug(path: string): string | null {
    return path.match(/([\w-]+)\.(svelte\.md|md|svx)/i)?.[1] ?? null;
}

interface MdsvexModule {
    default: ConstructorOfATypedSvelteComponent;
    metadata: Record<string, unknown>;
}

type GlobImport = Record<string, () => Promise<MdsvexModule>>;

export async function loadMarkdownContent<T>(
    glob: GlobImport,
    schema: z.ZodType<T>
): Promise<T[]> {
    const entries = Object.entries(glob);

    const results = await Promise.all(
        entries.map(async ([path, resolver]) => {
            const slug = extractSlug(path);
            if (!slug) return null;

            const module = await resolver();
            const data = { slug, ...module.metadata };
            const parsed = schema.safeParse(data);

            if (!parsed.success) {
                if (dev) {
                    console.warn(`Invalid frontmatter in ${path}:`, parsed.error.format());
                }
                return null;
            }

            return parsed.data;
        })
    );

    return results.filter((item): item is T => item !== null);
}

export async function resolveContentBySlug(
    glob: GlobImport,
    slug: string
): Promise<{ component: ConstructorOfATypedSvelteComponent; frontmatter: Record<string, unknown> }> {
    for (const [path, resolver] of Object.entries(glob)) {
        if (extractSlug(path) === slug) {
            const module = await resolver();
            if (!module.metadata.published) {
                throw error(404);
            }
            return {
                component: module.default,
                frontmatter: module.metadata
            };
        }
    }
    throw error(404);
}
```

- [ ] **Step 2: Verify types**

Run: `npm run check`
Expected: No type errors in `utils.ts`

- [ ] **Step 3: Commit**

```bash
git add src/lib/utils.ts
git commit -m "Extract shared content loading utilities with Zod validation"
```

### Task 12: Update app.d.ts to use Zod-derived types

**Files:**
- Modify: `src/app.d.ts`

- [ ] **Step 1: Replace manual interfaces with Zod-derived types**

Replace the entire contents of `src/app.d.ts` with:

```typescript
import '$lib/styles/main.css';

declare global {
    namespace App {
        // interface Error {}
        // interface Locals {}
        // interface PageData {}
        // interface PageState {}
        // interface Platform {}

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
```

- [ ] **Step 2: Commit**

```bash
git add src/app.d.ts
git commit -m "Derive App types from Zod schemas in app.d.ts"
```

### Task 13: Refactor blog routes to use shared utilities

**Files:**
- Modify: `src/routes/blog/+page.server.ts`
- Modify: `src/routes/blog/[slug]/+page.ts`

- [ ] **Step 1: Rewrite blog/+page.server.ts**

Replace the entire contents of `src/routes/blog/+page.server.ts` with:

```typescript
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
```

- [ ] **Step 2: Rewrite blog/[slug]/+page.ts**

Replace the entire contents of `src/routes/blog/[slug]/+page.ts` with:

```typescript
import type { PageLoad } from './$types';
import { resolveContentBySlug } from '$lib/utils';

export const load: PageLoad = async ({ params }) => {
    const glob = import.meta.glob('/src/lib/posts/*.md');
    return resolveContentBySlug(glob, params.slug);
};
```

- [ ] **Step 3: Verify**

Run: `npm run check`
Expected: No errors

Run: `npm run dev` and navigate to `/blog` and click a blog post
Expected: Blog listing loads, individual post renders correctly

- [ ] **Step 4: Commit**

```bash
git add src/routes/blog/+page.server.ts src/routes/blog/[slug]/+page.ts
git commit -m "Refactor blog routes to use shared content utilities"
```

### Task 14: Refactor notes routes to use shared utilities

**Files:**
- Modify: `src/routes/notes/+page.server.ts`
- Modify: `src/routes/notes/[slug]/+page.ts`

- [ ] **Step 1: Rewrite notes/+page.server.ts**

Replace the entire contents of `src/routes/notes/+page.server.ts` with:

```typescript
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
```

Note: The glob path is `/src/notes/*.md` (NOT under `src/lib/`).

- [ ] **Step 2: Rewrite notes/[slug]/+page.ts**

Replace the entire contents of `src/routes/notes/[slug]/+page.ts` with:

```typescript
import type { PageLoad } from './$types';
import { resolveContentBySlug } from '$lib/utils';

export const load: PageLoad = async ({ params }) => {
    const glob = import.meta.glob('/src/notes/*.md');
    return resolveContentBySlug(glob, params.slug);
};
```

- [ ] **Step 3: Verify**

Run: `npm run check`
Expected: No errors

Run: `npm run dev` and navigate to `/notes`
Expected: Notes listing loads (may be empty if no published notes — the only note has `published: false`)

- [ ] **Step 4: Commit**

```bash
git add src/routes/notes/+page.server.ts src/routes/notes/[slug]/+page.ts
git commit -m "Refactor notes routes to use shared content utilities"
```

### Task 15: Clean up dead code and fix svelte.config.js

**Files:**
- Modify: `src/routes/blog/+page.svelte` (if `currentPath` wasn't already removed in Task 7)
- Modify: `src/routes/notes/+page.svelte` (if `currentPath` wasn't already removed in Task 8)
- Modify: `svelte.config.js`

- [ ] **Step 1: Remove redundant highlighter.loadLanguage() in svelte.config.js**

In `svelte.config.js`, remove line 28:

```javascript
await highlighter.loadLanguage('javascript', 'typescript')
```

The languages are already loaded on lines 21-22 via `langs: shikiLangs` in the `getHighlighter` call.

Also fix the duplicate cache key on line 16. Replace:
```javascript
const key = [...shikiLangs, ...shikiLangs].join('-');
```
with:
```javascript
const key = [...shikiThemes, ...shikiLangs].join('-');
```

- [ ] **Step 2: Verify Layer 3 is complete**

Run: `npm run check`
Expected: Zero errors

Run: `npm run build`
Expected: Clean build

Run: `grep -r 'as unknown' src/ --include='*.ts' --include='*.svelte'`
Expected: No matches

Run: `grep -rn 'match.*svelte\\\.md\|match.*\\.md\|match.*\\.svx' src/ --include='*.ts' --include='*.svelte'`
Expected: Only in `src/lib/utils.ts`

- [ ] **Step 3: Manual verification of content pipeline**

Run: `npm run dev` and verify:
- `/blog` — lists the "Baby Steps" post with correct date and read time
- `/blog/baby-steps` — renders the full post
- `/notes` — loads (empty list since the only note is unpublished)
- Navigate to `/blog/nonexistent-slug` — shows 404 error page

- [ ] **Step 4: Commit**

```bash
git add svelte.config.js
git commit -m "Remove redundant highlighter.loadLanguage and fix cache key"
```

---

## Layer 4: SEO & Accessibility

### Task 16: Add default meta tags in layout

**Files:**
- Modify: `src/routes/+layout.svelte`

- [ ] **Step 1: Add default SEO meta tags**

In `src/routes/+layout.svelte`, replace the existing `<svelte:head>` block with:

```svelte
<svelte:head>
    <link rel="shortcut icon" href={GoobFavicon} />
    <meta name="description" content="Tim Cai — software engineer, writer, and maker of things." />
    <meta property="og:title" content="Tim Cai" />
    <meta property="og:description" content="Tim Cai — software engineer, writer, and maker of things." />
    <meta property="og:url" content={$page.url.href} />
    <meta property="og:type" content="website" />
    <link rel="canonical" href={$page.url.href} />
</svelte:head>
```

These are defaults. Individual pages can override them with their own `<svelte:head>` blocks (SvelteKit merges them, with child pages taking precedence).

- [ ] **Step 2: Commit**

```bash
git add src/routes/+layout.svelte
git commit -m "Add default SEO meta tags in layout"
```

### Task 17: Add page-specific meta tags

**Files:**
- Modify: `src/routes/blog/[slug]/+page.svelte`
- Modify: `src/routes/blog/+page.svelte`
- Modify: `src/routes/notes/+page.svelte`

- [ ] **Step 1: Add article meta tags to blog/[slug]/+page.svelte**

In `src/routes/blog/[slug]/+page.svelte`, add `page` import and replace the `<svelte:head>` block:

Add to the script block:
```typescript
    import { page } from '$app/stores';
```

Replace `<svelte:head>`:
```svelte
<svelte:head>
    <title>{data.frontmatter.title} — Tim Cai</title>
    <meta name="description" content="{data.frontmatter.title} by {data.frontmatter.author}" />
    <meta property="og:title" content={data.frontmatter.title} />
    <meta property="og:description" content="{data.frontmatter.title} by {data.frontmatter.author}" />
    <meta property="og:url" content={$page.url.href} />
    <meta property="og:type" content="article" />
    <meta property="article:published_time" content={data.frontmatter.date} />
    <meta property="article:author" content={data.frontmatter.author} />
    <link rel="canonical" href={$page.url.href} />
</svelte:head>
```

- [ ] **Step 2: Add meta tags to blog/+page.svelte**

Replace `<svelte:head>`:
```svelte
<svelte:head>
    <title>Blog — Tim Cai</title>
    <meta name="description" content="Blog posts by Tim Cai" />
    <meta property="og:title" content="Blog — Tim Cai" />
    <meta property="og:description" content="Blog posts by Tim Cai" />
</svelte:head>
```

- [ ] **Step 3: Add meta tags to notes/+page.svelte**

Replace `<svelte:head>`:
```svelte
<svelte:head>
    <title>Notes — Tim Cai</title>
    <meta name="description" content="Notes by Tim Cai" />
    <meta property="og:title" content="Notes — Tim Cai" />
    <meta property="og:description" content="Notes by Tim Cai" />
</svelte:head>
```

- [ ] **Step 4: Verify**

Run: `npm run build`
Expected: Clean build

Run: `npm run dev`, view page source on `/`, `/blog`, `/blog/baby-steps`, `/notes`
Expected: Each page has appropriate meta tags in the `<head>`

- [ ] **Step 5: Commit**

```bash
git add src/routes/blog/[slug]/+page.svelte src/routes/blog/+page.svelte src/routes/notes/+page.svelte
git commit -m "Add page-specific SEO meta tags for blog and notes"
```

### Task 18: Add accessibility improvements

**Files:**
- Modify: `src/routes/+layout.svelte`
- Modify: `src/lib/styles/main.css`

- [ ] **Step 1: Add skip-to-content link in +layout.svelte**

In `src/routes/+layout.svelte`, add this as the very first element after `<svelte:window>`:

```svelte
<a href="#main-content" class="skip-link">Skip to content</a>
```

Add `id="main-content"` to the slot render. Replace:
```svelte
{@render children()}
```
with:
```svelte
<main id="main-content">
    {@render children()}
</main>
```

- [ ] **Step 2: Add aria-labels to icon-only links**

In `src/routes/+layout.svelte`, update the GitHub link:
```svelte
            <a class="text-lg" target="_blank" href="https://github.com/TAMUTim" aria-label="GitHub profile">
```

Update the resume link:
```svelte
            <a class="text-lg font-semibold mr-6" href={Resume} target="_blank" aria-label="Download resume">Resume</a>
```

Update the scroll-to-top button:
```svelte
<button
        title="Scroll to the top"
        aria-label="Scroll to top"
        class="fixed right-3 bottom-3 w-10 h-10 rounded-full z-100 print:hidden text-slate-200 {y > 10 ? 'opacity-100' : 'opacity-0'}"
        onclick={scrollToTop}
>
```

- [ ] **Step 3: Add skip-link styles to main.css**

Add to the end of `src/lib/styles/main.css`:

```css
.skip-link {
    position: absolute;
    top: -100%;
    left: 0;
    padding: 0.5rem 1rem;
    background: var(--c-accent);
    color: var(--c-bg);
    font-weight: 600;
    z-index: 9999;
    transition: top 0.2s;
}

.skip-link:focus {
    top: 0;
}

/* Focus styling for error page button and other interactive elements */
button:focus-visible {
    outline: 2px solid var(--c-accent);
    outline-offset: 2px;
}
```

- [ ] **Step 4: Verify**

Run: `npm run build`
Expected: Clean build

Manual test: Open the site, press Tab — skip-to-content link should appear. Press Enter — page scrolls to main content.

- [ ] **Step 5: Commit**

```bash
git add src/routes/+layout.svelte src/lib/styles/main.css
git commit -m "Add skip-to-content link and aria-labels for accessibility"
```

### Task 19: Final verification

- [ ] **Step 1: Full build and type check**

Run: `npm run check`
Expected: Zero errors

Run: `npm run build`
Expected: Clean production build

- [ ] **Step 2: Full manual smoke test**

Run: `npm run dev` and verify every route:
- `/` — home page with dots, meta tags in source
- `/blog` — blog listing, meta tags
- `/blog/baby-steps` — full post with article meta tags
- `/notes` — notes listing, meta tags
- `/hundred` — titles list
- `/projects` — under construction
- `/nonexistent` — 404 error page, "way back" button works
- Keyboard nav: Tab shows skip link, all interactive elements focusable
- Scroll down: scroll-to-top button appears with aria-label

- [ ] **Step 3: Verify no legacy patterns remain**

```bash
grep -r '\$:' src/ --include='*.svelte'
grep -r 'export let' src/ --include='*.svelte'
grep -r 'on:click\|on:submit' src/ --include='*.svelte'
grep -r 'as unknown' src/ --include='*.ts' --include='*.svelte'
grep -r 'p5-svelte\|svelte-meta-tags' src/
```

Expected: All return no matches.

- [ ] **Step 4: Final commit if any remaining changes**

```bash
git status
# If clean, skip. Otherwise:
git add -A
git commit -m "Final cleanup: modernize + polish complete"
```
