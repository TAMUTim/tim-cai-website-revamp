# Mobile Responsiveness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every page of the site work cleanly on mobile screens (375–428px) without breaking the existing desktop experience.

**Architecture:** All changes use Tailwind responsive prefixes with a single `sm` (640px) breakpoint. Fixed-width containers become fluid with max-width caps. A hamburger menu replaces the horizontal nav on mobile. The WebGL shader is disabled on mobile in favor of the existing CSS gradient fallback.

**Tech Stack:** SvelteKit 2, Svelte 5 (runes), Tailwind CSS, Font Awesome (already installed)

**Note:** No test framework is configured. Verification uses `npm run check` (TypeScript), `npm run build` (production build), and manual inspection via `npm run dev` with browser DevTools responsive mode.

---

## File Structure

All changes modify existing files. No new files are created.

| File | Changes |
|------|---------|
| `src/lib/components/ShaderBackground.svelte` | Disable WebGL on mobile, remove isMobile conditionals |
| `tailwind.config.js` | Remove unused `w-content` and `w-hundred` custom widths |
| `src/routes/+layout.svelte` | Hamburger nav, logo alignment, footer responsive width |
| `src/routes/+page.svelte` | Responsive width, text sizing, spacing |
| `src/routes/blog/+page.svelte` | Responsive width, text sizing, spacing, list reflow |
| `src/routes/blog/[slug]/+page.svelte` | Responsive width, text sizing, spacing |
| `src/routes/notes/+page.svelte` | Responsive width, text sizing, spacing, list reflow |
| `src/routes/notes/[slug]/+page.svelte` | Responsive width, text sizing, spacing |
| `src/routes/hundred/+page.svelte` | Responsive width, min-height, spacing |
| `src/routes/projects/+page.svelte` | Responsive width, text sizing, spacing |
| `src/routes/+error.svelte` | Responsive width, text sizing, spacing |

---

### Task 1: Disable shader on mobile

**Files:**
- Modify: `src/lib/components/ShaderBackground.svelte`

- [ ] **Step 1: Move isMobile check before WebGL context creation and combine with reduced-motion guard**

In `src/lib/components/ShaderBackground.svelte`, replace the current early-exit logic and isMobile computation:

```typescript
// OLD (lines 17-34):
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    fallback = true;
    return;
}

const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    premultipliedAlpha: false,
});

if (!gl) {
    fallback = true;
    return;
}

const glCtx = gl;
const isMobile = window.innerWidth < 768;
```

```typescript
// NEW:
const isMobile = window.innerWidth < 640;

if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || isMobile) {
    fallback = true;
    return;
}

const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    premultipliedAlpha: false,
});

if (!gl) {
    fallback = true;
    return;
}

const glCtx = gl;
```

- [ ] **Step 2: Remove isMobile conditionals from mouse tracking setup**

Since we now return early for mobile, the code below only runs on desktop. Remove the `isMobile` guards around mouse listeners.

Replace the mouse listener setup (lines 50-53):
```typescript
// OLD:
if (!isMobile) {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseleave', onMouseLeave);
}
```

```typescript
// NEW:
window.addEventListener('mousemove', onMouseMove);
window.addEventListener('mouseleave', onMouseLeave);
```

- [ ] **Step 3: Remove isMobile conditional from cleanup**

Replace the cleanup mouse listener removal (lines 100-103):
```typescript
// OLD:
if (!isMobile) {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseleave', onMouseLeave);
}
```

```typescript
// NEW:
window.removeEventListener('mousemove', onMouseMove);
window.removeEventListener('mouseleave', onMouseLeave);
```

- [ ] **Step 4: Verify**

Run: `npm run check`
Expected: No errors.

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/ShaderBackground.svelte
git commit -m "perf: disable WebGL shader on mobile, use CSS fallback"
```

---

### Task 2: Responsive content width

Replace all `w-content` (fixed 640px) usages with `w-full max-w-[40rem] px-5 sm:px-0` so content is fluid on mobile with 20px side padding, capped at 640px on desktop. Remove unused custom widths from Tailwind config.

**Files:**
- Modify: `tailwind.config.js`
- Modify: `src/routes/+page.svelte`
- Modify: `src/routes/blog/+page.svelte`
- Modify: `src/routes/blog/[slug]/+page.svelte`
- Modify: `src/routes/notes/+page.svelte`
- Modify: `src/routes/notes/[slug]/+page.svelte`
- Modify: `src/routes/hundred/+page.svelte`
- Modify: `src/routes/projects/+page.svelte`
- Modify: `src/routes/+error.svelte`
- Modify: `src/routes/+layout.svelte`

- [ ] **Step 1: Replace w-content in `src/routes/+page.svelte`**

There are 3 instances. Replace each `w-content` with `w-full max-w-[40rem] px-5 sm:px-0`:

Line 14: `<div class="w-content"` → `<div class="w-full max-w-[40rem] px-5 sm:px-0"`
Line 24: `<div class="w-content"` → `<div class="w-full max-w-[40rem] px-5 sm:px-0"`
Line 42: `<div class="w-content"` → `<div class="w-full max-w-[40rem] px-5 sm:px-0"`

- [ ] **Step 2: Replace w-content in `src/routes/blog/+page.svelte`**

Line 44: `<div class="w-content flex flex-row gap-4 font-nabla"` → `<div class="w-full max-w-[40rem] px-5 sm:px-0 flex flex-row gap-4 font-nabla"`
Line 53: `<div class="w-content flex flex-col mt-14 gap-16"` → `<div class="w-full max-w-[40rem] px-5 sm:px-0 flex flex-col mt-14 gap-16"`

- [ ] **Step 3: Replace w-content in `src/routes/blog/[slug]/+page.svelte`**

Line 23: `<div class="w-content"` → `<div class="w-full max-w-[40rem] px-5 sm:px-0"`
Line 28: `<div class="w-content text-slate-300 mt-8 prose prose-content"` → `<div class="w-full max-w-[40rem] px-5 sm:px-0 text-slate-300 mt-8 prose prose-content"`

- [ ] **Step 4: Replace w-content in `src/routes/notes/+page.svelte`**

Line 39: `<div class="w-content flex flex-row gap-4 font-nabla"` → `<div class="w-full max-w-[40rem] px-5 sm:px-0 flex flex-row gap-4 font-nabla"`
Line 48: `<div class="w-content flex flex-col mt-14 gap-16"` → `<div class="w-full max-w-[40rem] px-5 sm:px-0 flex flex-col mt-14 gap-16"`

- [ ] **Step 5: Replace w-content in `src/routes/notes/[slug]/+page.svelte`**

Line 14: `<div class="w-content"` → `<div class="w-full max-w-[40rem] px-5 sm:px-0"`
Line 19: `<div class="w-content text-slate-300 text-lg mt-10"` → `<div class="w-full max-w-[40rem] px-5 sm:px-0 text-slate-300 text-lg mt-10"`

- [ ] **Step 6: Replace w-content in `src/routes/hundred/+page.svelte`**

Line 17 currently:
```html
<div class="flex flex-col flex-wrap mt-10 w-content border-2 min-h-[45rem] font-ibmMono" style="--stagger: 1" data-animate>
```
Replace with:
```html
<div class="flex flex-col flex-wrap mt-10 w-full max-w-[40rem] px-5 sm:px-0 border-2 sm:min-h-[45rem] font-ibmMono" style="--stagger: 1" data-animate>
```

Also change the outer div (line 16) from `mt-20` to `mt-10 sm:mt-20`:
```html
<!-- OLD: -->
<div class="flex items-center justify-center mt-20">
<!-- NEW: -->
<div class="flex items-center justify-center mt-10 sm:mt-20">
```

- [ ] **Step 7: Replace w-content in `src/routes/projects/+page.svelte`**

Line 2: `<div class="w-content prose"` → `<div class="w-full max-w-[40rem] px-5 sm:px-0 prose"`

- [ ] **Step 8: Replace w-content in `src/routes/+error.svelte`**

Line 17: `<div class="w-content"` → `<div class="w-full max-w-[40rem] px-5 sm:px-0"`

- [ ] **Step 9: Replace w-content in `src/routes/+layout.svelte` (footer)**

Line 95: `<div class="mt-10 mb-6 w-content"` → `<div class="mt-10 mb-6 w-full max-w-[40rem] px-5 sm:px-0"`

- [ ] **Step 10: Remove custom widths from `tailwind.config.js`**

Remove the `width` block from the `extend` section. First verify `w-hundred` is unused:

Run: `grep -r "w-hundred" src/`
Expected: No results (confirming it's unused).

Then remove lines 14-17 of `tailwind.config.js`:
```javascript
// REMOVE:
      width: {
        'content': '40rem',
        'hundred': '55rem'
      },
```

- [ ] **Step 11: Verify**

Run: `npm run check`
Expected: No errors.

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 12: Commit**

```bash
git add tailwind.config.js src/routes/+page.svelte src/routes/blog/+page.svelte src/routes/blog/\\[slug\\]/+page.svelte src/routes/notes/+page.svelte src/routes/notes/\\[slug\\]/+page.svelte src/routes/hundred/+page.svelte src/routes/projects/+page.svelte src/routes/+error.svelte src/routes/+layout.svelte
git commit -m "fix: replace fixed w-content with responsive fluid width"
```

---

### Task 3: Hamburger nav + logo alignment

Add a slide-down hamburger menu for mobile, fix logo centering.

**Files:**
- Modify: `src/routes/+layout.svelte`

- [ ] **Step 1: Add menuOpen state and close-on-navigate effect**

In the `<script>` block of `src/routes/+layout.svelte`, add after the `let y` declaration (line 35):

```typescript
let menuOpen = $state(false);

$effect(() => {
    $page.url.pathname;
    menuOpen = false;
});
```

This `$effect` tracks `$page.url.pathname` as a dependency. Whenever the path changes (navigation), it closes the menu.

- [ ] **Step 2: Fix logo alignment**

Change the logo container from centering on mobile to always left-aligned.

Line 61, replace:
```html
<div class="flex flex-1 items-center justify-center sm:items-stretch sm:justify-start">
```
with:
```html
<div class="flex flex-1 items-center justify-start">
```

- [ ] **Step 3: Add hamburger button**

Inside the nav bar's `relative flex h-16` container (after the logo div, before the nav-links div), add the hamburger button. This button is only visible below `sm`:

Insert after the closing `</div>` of the logo container (after line 65):

```html
<button
    class="sm:hidden text-slate-200 p-2"
    onclick={() => menuOpen = !menuOpen}
    aria-label="Toggle menu"
    aria-expanded={menuOpen}
>
    <i class="fa-solid {menuOpen ? 'fa-xmark' : 'fa-bars'} text-xl"></i>
</button>
```

- [ ] **Step 4: Hide desktop nav links on mobile**

Change the nav-links container to be hidden on mobile, only visible at `sm` and above.

Replace the nav-links div opening tag (line 66):
```html
<div class="nav-links font-nabla absolute inset-y-0 right-0 flex items-center pr-2 sm:static sm:inset-auto sm:ml-6 sm:pr-0">
```
with:
```html
<div class="nav-links font-nabla hidden sm:flex absolute inset-y-0 right-0 items-center pr-2 sm:static sm:inset-auto sm:ml-6 sm:pr-0">
```

- [ ] **Step 5: Add mobile slide-down panel**

Add the mobile menu panel immediately after the closing `</div>` of the `relative flex h-16` container (after the nav-links closing div). This goes inside the `mx-auto px-2 py-2` container:

```html
{#if menuOpen}
    <div class="sm:hidden nav-links font-nabla border-t border-slate-800">
        <div class="flex flex-col py-2">
            <a class="py-3 px-4 text-lg font-semibold" href="/blog">Blog</a>
            <a class="py-3 px-4 text-lg font-semibold" href="/notes">Notes</a>
            <a class="py-3 px-4 text-lg font-semibold" href="/projects">Projects</a>
            <a class="py-3 px-4 text-lg font-semibold" href="/hundred">100</a>
            <a class="py-3 px-4 text-lg font-semibold" href={Resume} target="_blank">Resume</a>
            <a class="py-3 px-4 text-lg" target="_blank" href="https://github.com/TAMUTim" aria-label="GitHub profile">
                <i class="fa-brands fa-github"></i> GitHub
            </a>
        </div>
    </div>
{/if}
```

- [ ] **Step 6: Add nav background for readability**

The nav currently has no background, which means the hamburger menu and sticky nav float over the shader/content without contrast. Add a semi-transparent background to the nav element.

Change the `<nav>` tag:
```html
<!-- OLD: -->
<nav class="font-ibm z-10 sticky top-0">
<!-- NEW: -->
<nav class="font-ibm z-10 sticky top-0 bg-black/80 backdrop-blur-sm">
```

- [ ] **Step 7: Verify**

Run: `npm run check`
Expected: No errors.

Run: `npm run build`
Expected: Build succeeds.

Manual verification with `npm run dev`:
- At 375px width: hamburger icon visible, tapping shows slide-down panel, tapping again closes it, clicking a link navigates and closes the panel.
- At 640px+ width: hamburger hidden, horizontal nav links visible as before.
- Logo is left-aligned at all widths.

- [ ] **Step 8: Commit**

```bash
git add src/routes/+layout.svelte
git commit -m "feat: add mobile hamburger nav with slide-down panel"
```

---

### Task 4: Responsive text sizing and spacing

Scale headings down on mobile, reduce top margins on mobile.

**Files:**
- Modify: `src/routes/+page.svelte`
- Modify: `src/routes/blog/+page.svelte`
- Modify: `src/routes/blog/[slug]/+page.svelte`
- Modify: `src/routes/notes/+page.svelte`
- Modify: `src/routes/notes/[slug]/+page.svelte`
- Modify: `src/routes/projects/+page.svelte`
- Modify: `src/routes/+error.svelte`

- [ ] **Step 1: Home page (`src/routes/+page.svelte`)**

Line 13 — reduce top margin:
```html
<!-- OLD: -->
<div class="flex flex-col items-center justify-center font-ibm mt-10">
<!-- NEW: -->
<div class="flex flex-col items-center justify-center font-ibm mt-6 sm:mt-10">
```

Line 15 — scale heading:
```html
<!-- OLD: -->
<p class="text-5xl text-left font-semibold font-nabla text-slate-50">Tim Cai</p>
<!-- NEW: -->
<p class="text-3xl sm:text-5xl text-left font-semibold font-nabla text-slate-50">Tim Cai</p>
```

- [ ] **Step 2: Blog listing (`src/routes/blog/+page.svelte`)**

Line 43 — reduce top margin:
```html
<!-- OLD: -->
<div class="flex flex-col items-center justify-center font-ibm mt-10">
<!-- NEW: -->
<div class="flex flex-col items-center justify-center font-ibm mt-6 sm:mt-10">
```

Line 46 — scale "Blog" heading:
```html
<!-- OLD: -->
<p class="text-4xl font-semibold text-slate-50">Blog</p>
<!-- NEW: -->
<p class="text-2xl sm:text-4xl font-semibold text-slate-50">Blog</p>
```

Line 49 — scale "Notes" heading:
```html
<!-- OLD: -->
<p class="text-4xl font-semibold text-slate-50">Notes</p>
<!-- NEW: -->
<p class="text-2xl sm:text-4xl font-semibold text-slate-50">Notes</p>
```

Line 53 — reduce section gap:
```html
<!-- OLD: -->
<div class="w-full max-w-[40rem] px-5 sm:px-0 flex flex-col mt-14 gap-16" style="--stagger: 2" data-animate>
<!-- NEW: -->
<div class="w-full max-w-[40rem] px-5 sm:px-0 flex flex-col mt-8 sm:mt-14 gap-10 sm:gap-16" style="--stagger: 2" data-animate>
```

Line 56 — scale year heading:
```html
<!-- OLD: -->
<p class="text-4xl text-right font-nabla">{ year }</p>
<!-- NEW: -->
<p class="text-2xl sm:text-4xl text-right font-nabla">{ year }</p>
```

- [ ] **Step 3: Blog detail (`src/routes/blog/[slug]/+page.svelte`)**

Line 22 — reduce top margin:
```html
<!-- OLD: -->
<div class="flex flex-col items-center justify-center font-ibm mt-10">
<!-- NEW: -->
<div class="flex flex-col items-center justify-center font-ibm mt-6 sm:mt-10">
```

Line 24 — scale title:
```html
<!-- OLD: -->
<p class="text-4xl text-slate-300 font-nabla font-semibold">{ data.frontmatter.title }</p>
<!-- NEW: -->
<p class="text-2xl sm:text-4xl text-slate-300 font-nabla font-semibold">{ data.frontmatter.title }</p>
```

Line 25 — scale date subtitle:
```html
<!-- OLD: -->
<p class="mt-4 text-slate-400 text-2xl">{ getFormattedDate(data.frontmatter.date) } · { data.frontmatter.readTime } min</p>
<!-- NEW: -->
<p class="mt-4 text-slate-400 text-lg sm:text-2xl">{ getFormattedDate(data.frontmatter.date) } · { data.frontmatter.readTime } min</p>
```

- [ ] **Step 4: Notes listing (`src/routes/notes/+page.svelte`)**

Line 38 — reduce top margin:
```html
<!-- OLD: -->
<div class="flex flex-col items-center justify-center font-ibm mt-10">
<!-- NEW: -->
<div class="flex flex-col items-center justify-center font-ibm mt-6 sm:mt-10">
```

Line 41 — scale "Blog" link heading:
```html
<!-- OLD: -->
<p class="text-4xl font-semibold text-slate-50">Blog</p>
<!-- NEW: -->
<p class="text-2xl sm:text-4xl font-semibold text-slate-50">Blog</p>
```

Line 44 — scale "Notes" link heading:
```html
<!-- OLD: -->
<p class="text-4xl font-semibold text-slate-50">Notes</p>
<!-- NEW: -->
<p class="text-2xl sm:text-4xl font-semibold text-slate-50">Notes</p>
```

Line 48 — reduce section gap:
```html
<!-- OLD: -->
<div class="w-full max-w-[40rem] px-5 sm:px-0 flex flex-col mt-14 gap-16" style="--stagger: 2" data-animate>
<!-- NEW: -->
<div class="w-full max-w-[40rem] px-5 sm:px-0 flex flex-col mt-8 sm:mt-14 gap-10 sm:gap-16" style="--stagger: 2" data-animate>
```

Line 51 — scale topic heading:
```html
<!-- OLD: -->
<p class="text-4xl font-nabla text-right">{ topic }</p>
<!-- NEW: -->
<p class="text-2xl sm:text-4xl font-nabla text-right">{ topic }</p>
```

- [ ] **Step 5: Notes detail (`src/routes/notes/[slug]/+page.svelte`)**

Line 13 — reduce top margin:
```html
<!-- OLD: -->
<div class="flex flex-col items-center justify-center font-ibm mt-10">
<!-- NEW: -->
<div class="flex flex-col items-center justify-center font-ibm mt-6 sm:mt-10">
```

Line 15 — scale title:
```html
<!-- OLD: -->
<p class="text-4xl text-slate-300 font-semibold">{ data.frontmatter.title }</p>
<!-- NEW: -->
<p class="text-2xl sm:text-4xl text-slate-300 font-semibold">{ data.frontmatter.title }</p>
```

Line 16 — scale date subtitle:
```html
<!-- OLD: -->
<p class="mt-4 text-slate-400 text-2xl">{ getFormattedDate(data.frontmatter.date) } · { data.frontmatter.readTime } min</p>
<!-- NEW: -->
<p class="mt-4 text-slate-400 text-lg sm:text-2xl">{ getFormattedDate(data.frontmatter.date) } · { data.frontmatter.readTime } min</p>
```

- [ ] **Step 6: Projects page (`src/routes/projects/+page.svelte`)**

Line 1 — reduce top margin:
```html
<!-- OLD: -->
<div class="flex flex-col items-center justify-center font-ibm mt-10">
<!-- NEW: -->
<div class="flex flex-col items-center justify-center font-ibm mt-6 sm:mt-10">
```

Line 3 — scale heading:
```html
<!-- OLD: -->
<p class="text-3xl font-semibold text-slate-50">Under construction...</p>
<!-- NEW: -->
<p class="text-xl sm:text-3xl font-semibold text-slate-50">Under construction...</p>
```

- [ ] **Step 7: Error page (`src/routes/+error.svelte`)**

Line 16 — reduce top margin:
```html
<!-- OLD: -->
<div class="flex flex-col items-center justify-center font-ibm mt-10">
<!-- NEW: -->
<div class="flex flex-col items-center justify-center font-ibm mt-6 sm:mt-10">
```

Line 18 — scale heading:
```html
<!-- OLD: -->
<p class="text-3xl font-semibold text-slate-50">Error 404 or something...</p>
<!-- NEW: -->
<p class="text-xl sm:text-3xl font-semibold text-slate-50">Error 404 or something...</p>
```

- [ ] **Step 8: Verify**

Run: `npm run check`
Expected: No errors.

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 9: Commit**

```bash
git add src/routes/+page.svelte src/routes/blog/+page.svelte src/routes/blog/\\[slug\\]/+page.svelte src/routes/notes/+page.svelte src/routes/notes/\\[slug\\]/+page.svelte src/routes/projects/+page.svelte src/routes/+error.svelte
git commit -m "fix: add responsive text sizing and spacing for mobile"
```

---

### Task 5: Blog/Notes list reflow

Switch blog and notes listing pages from right-aligned to left-aligned on mobile, stack metadata below titles.

**Files:**
- Modify: `src/routes/blog/+page.svelte`
- Modify: `src/routes/notes/+page.svelte`

- [ ] **Step 1: Blog listing reflow (`src/routes/blog/+page.svelte`)**

Change year heading alignment (line 56 after Task 4 changes):
```html
<!-- OLD: -->
<p class="text-2xl sm:text-4xl text-right font-nabla">{ year }</p>
<!-- NEW: -->
<p class="text-2xl sm:text-4xl text-left sm:text-right font-nabla">{ year }</p>
```

Change post entry alignment (line 59):
```html
<!-- OLD: -->
<div class="text-right">
<!-- NEW: -->
<div class="text-left sm:text-right">
```

Change metadata span to stack on mobile (line 62). The current span is inline with `ml-3`:
```html
<!-- OLD: -->
<span class="ml-3 text-right font-semibold text-xl text-slate-400 mt-2">{getFormattedDate(date)} · {readTime} min</span>
<!-- NEW: -->
<span class="block sm:inline ml-0 sm:ml-3 text-right font-semibold text-base sm:text-xl text-slate-400 mt-1 sm:mt-2">{getFormattedDate(date)} · {readTime} min</span>
```

- [ ] **Step 2: Notes listing reflow (`src/routes/notes/+page.svelte`)**

Change topic heading alignment (line 51 after Task 4 changes):
```html
<!-- OLD: -->
<p class="text-2xl sm:text-4xl font-nabla text-right">{ topic }</p>
<!-- NEW: -->
<p class="text-2xl sm:text-4xl font-nabla text-left sm:text-right">{ topic }</p>
```

Change note entry alignment (line 54):
```html
<!-- OLD: -->
<div class="text-right">
<!-- NEW: -->
<div class="text-left sm:text-right">
```

Change metadata span to stack on mobile (line 56). Current span:
```html
<!-- OLD: -->
<span class="ml-3 text-right font-semibold text-xl text-slate-400 mt-2">{readTime} min</span>
<!-- NEW: -->
<span class="block sm:inline ml-0 sm:ml-3 text-right font-semibold text-base sm:text-xl text-slate-400 mt-1 sm:mt-2">{readTime} min</span>
```

- [ ] **Step 3: Verify**

Run: `npm run check`
Expected: No errors.

Run: `npm run build`
Expected: Build succeeds.

Manual verification with `npm run dev`:
- At 375px: blog/notes lists left-aligned, metadata stacked below title in smaller text.
- At 640px+: blog/notes lists right-aligned, metadata inline after title, same as before.

- [ ] **Step 4: Commit**

```bash
git add src/routes/blog/+page.svelte src/routes/notes/+page.svelte
git commit -m "fix: reflow blog/notes lists for mobile — left-aligned, stacked metadata"
```

---

### Task 6: Final verification

Full-site manual verification across all routes and viewport widths.

- [ ] **Step 1: Run full checks**

Run: `npm run check`
Expected: No errors.

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 2: Manual verification**

Start dev server: `npm run dev`

Open browser DevTools responsive mode. For each viewport width (375px, 390px, 428px, 640px, 768px, 1024px), check each route:

| Route | What to verify |
|-------|---------------|
| `/` (home) | No horizontal scroll, heading scales, content has padding on mobile |
| `/blog` | List is left-aligned on mobile / right-aligned on desktop, metadata stacks on mobile |
| `/blog/[any-post]` | Title scales, prose content fits, code blocks scroll horizontally |
| `/notes` | Same as blog listing |
| `/notes/[any-note]` | Same as blog detail |
| `/projects` | Heading scales, content fits |
| `/hundred` | No min-height on mobile, reduced top margin, content fits |
| Error (visit `/nonexistent`) | Heading scales, content fits |

Hamburger nav (at 375px):
- [ ] Hamburger icon visible, logo left-aligned
- [ ] Tap opens slide-down panel
- [ ] All 6 links present and tappable
- [ ] Clicking a link navigates and closes menu
- [ ] Tap hamburger again closes menu

Desktop nav (at 1024px):
- [ ] Hamburger hidden
- [ ] All links visible horizontally
- [ ] Layout identical to before changes

Shader:
- [ ] At 375px: CSS gradient fallback visible, no WebGL canvas in DOM
- [ ] At 1024px: WebGL shader renders as before
