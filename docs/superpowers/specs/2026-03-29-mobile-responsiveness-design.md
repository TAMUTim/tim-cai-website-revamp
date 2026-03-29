# Mobile Responsiveness Overhaul — Design Spec

## Goal

Make every page of the site work cleanly on mobile screens (375–428px) without breaking the existing desktop experience. Single breakpoint at `sm` (640px).

## Constraints

- No new dependencies
- Tailwind utility classes only (no custom media queries in component `<style>` blocks unless necessary)
- Must not change any desktop layout or visual behavior
- All 8 routes must be covered: home, blog listing, blog detail, notes listing, notes detail, projects, hundred, error

---

## 1. Responsive Content Width

**Problem:** `w-content` is a custom Tailwind width of `40rem` (640px). Every page uses it. On phones (375px), content overflows by 265px, causing horizontal scroll. Same issue with `w-hundred` at `55rem` (880px).

**Solution:** Replace all `w-content` usages with `w-full max-w-[40rem] px-5 sm:px-0`. Replace all `w-hundred` usages with `w-full max-w-[55rem] px-5 sm:px-0`. Content fills the viewport with 20px side padding on mobile; caps at the current fixed width on larger screens.

**Files affected:**
- `src/routes/+page.svelte` — 3 instances of `w-content`
- `src/routes/blog/+page.svelte` — 2 instances
- `src/routes/blog/[slug]/+page.svelte` — 2 instances
- `src/routes/notes/+page.svelte` — 2 instances
- `src/routes/notes/[slug]/+page.svelte` — 2 instances
- `src/routes/hundred/+page.svelte` — 1 instance of `w-content`
- `src/routes/projects/+page.svelte` — 1 instance
- `src/routes/+error.svelte` — 1 instance
- `src/routes/+layout.svelte` — 1 instance (footer)

The `w-content` and `w-hundred` custom widths in `tailwind.config.js` can be removed after all usages are replaced, since they will no longer be referenced.

## 2. Mobile Hamburger Nav (Slide-Down Panel)

**Problem:** The navbar has 6 links (Blog, Notes, Projects, 100, Resume, GitHub) in a horizontal row with `text-lg` + `mr-6` spacing. On phones, these overflow or get extremely cramped.

**Solution:** Add a hamburger menu for screens below `sm` (640px).

**Behavior:**
- Below `sm`: hide the horizontal nav links, show a hamburger icon button (three-line icon from Font Awesome `fa-bars`, already available)
- Tapping the hamburger toggles a slide-down panel with vertically stacked links
- Panel has semi-transparent dark background (`bg-black/95`) to match site aesthetic
- Links are full-width, left-aligned, with comfortable tap targets (padding `py-3`)
- Tapping a link or tapping the hamburger again closes the panel
- Close on navigation (when `$page.url.pathname` changes)
- Above `sm`: current horizontal layout unchanged, hamburger hidden

**Animation:** Simple CSS transition on max-height and opacity for the slide-down.

**File affected:** `src/routes/+layout.svelte`

## 3. Disable Shader on Mobile

**Problem:** The WebGL2 flow field shader renders 3,000 particles on mobile. On small screens the effect is barely visible and costs GPU cycles / battery.

**Solution:** In `ShaderBackground.svelte`, treat mobile the same as `prefers-reduced-motion` — set `fallback = true` when `isMobile` is detected, which shows the CSS gradient fallback instead of initializing WebGL.

**Implementation:** The `isMobile` variable is already computed after the WebGL context is obtained. Add the mobile check right after the existing `prefers-reduced-motion` guard, before WebGL context creation:

```typescript
const isMobile = window.innerWidth < 768;

if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || isMobile) {
    fallback = true;
    return;
}
```

This combines both checks into a single guard, skipping WebGL initialization entirely on mobile.

**File affected:** `src/lib/components/ShaderBackground.svelte`

## 4. Responsive Text Sizing

**Problem:** Headings use fixed large sizes (`text-5xl`, `text-4xl`, `text-2xl`) that are too large for 375px screens.

**Solution:** Add responsive prefixes so text scales down on mobile:

| Element | Location | Current | Change to |
|---------|----------|---------|-----------|
| Home "Tim Cai" heading | `+page.svelte` | `text-5xl` | `text-3xl sm:text-5xl` |
| Blog/Notes page title ("Blog"/"Notes") | `blog/+page.svelte`, `notes/+page.svelte` | `text-4xl` | `text-2xl sm:text-4xl` |
| Blog/Notes year/topic headings | same files | `text-4xl` | `text-2xl sm:text-4xl` |
| Blog/Notes detail title | `blog/[slug]/+page.svelte`, `notes/[slug]/+page.svelte` | `text-4xl` | `text-2xl sm:text-4xl` |
| Blog/Notes detail date subtitle | same files | `text-2xl` | `text-lg sm:text-2xl` |
| Projects "Under construction" heading | `projects/+page.svelte` | `text-3xl` | `text-xl sm:text-3xl` |
| Error heading | `+error.svelte` | `text-3xl` | `text-xl sm:text-3xl` |

Body text (`text-lg`) stays as-is — 18px is readable on mobile.

## 5. Blog/Notes List Reflow

**Problem:** Blog and notes listing pages have right-aligned titles with date/readtime inline on the same line. On mobile, the title + metadata text wraps awkwardly in a narrow right-aligned column.

**Solution:** On mobile, switch to left-aligned layout with metadata stacked below the title.

**Blog listing (`blog/+page.svelte`):**
- Year heading: `text-right` → `text-left sm:text-right`
- Post container: `text-right` → `text-left sm:text-right`
- Metadata span: Currently inline after the title with `ml-3`. On mobile, display as a block element below the title. Use `block sm:inline sm:ml-3 ml-0 text-base sm:text-xl` so it stacks on mobile and stays inline on desktop.

**Notes listing (`notes/+page.svelte`):**
- Same pattern: topic heading and note entries switch from right-aligned to left-aligned on mobile, metadata stacks below.

## 6. Hundred Page

**Problem:** Uses `w-content` (640px fixed) with `min-h-[45rem]` and `border-2`, plus `mt-20` top margin. Overflows on mobile.

**Solution:**
- Replace `w-content` with responsive width (`w-full max-w-[40rem] px-5 sm:px-0`)
- Change `min-h-[45rem]` to `sm:min-h-[45rem]` (remove minimum height constraint on mobile)
- Change `mt-20` to `mt-10 sm:mt-20` (reduce top margin on mobile)
- The flex-wrap column layout works naturally at narrower widths

**File affected:** `src/routes/hundred/+page.svelte`

## 7. Footer

**Problem:** Footer in `+layout.svelte` uses `w-content` (640px fixed).

**Solution:** Replace `w-content` with `w-full max-w-[40rem] px-5 sm:px-0`, same as content areas.

## 8. Spacing Adjustments

**Problem:** Several pages use `mt-10` or `mt-14` top margins that create excessive whitespace on small screens.

**Solution:**
- Page top margins: `mt-10` → `mt-6 sm:mt-10` (home, blog, notes, blog detail, notes detail, projects, error)
- Blog/Notes listing section gap: `mt-14` → `mt-8 sm:mt-14` (in the `gap-16` flex container, change to `gap-10 sm:gap-16`)

---

## What Does NOT Change

- All desktop layouts remain identical
- Shader renders normally on desktop (only disabled on mobile < 768px)
- Dark theme, CSS variables, accent colors unchanged
- Animation system (`data-animate`, stagger) unchanged
- Typography plugin prose styling unchanged
- No new dependencies added
- Blog/notes markdown content rendering unchanged (prose plugin handles responsiveness)

## Testing

Manual testing at these viewport widths:
- 375px (iPhone SE)
- 390px (iPhone 12/13/14)
- 428px (iPhone 14 Pro Max)
- 640px (sm breakpoint boundary)
- 768px (tablet)
- 1024px+ (desktop, verify no regressions)

Check each route: home, blog listing, a blog post, notes listing, a note, projects, hundred, trigger error page.

Verify:
- No horizontal scrolling at any mobile width
- Hamburger menu opens/closes correctly
- Nav links navigate and close menu
- Text is readable without zooming
- Shader fallback (CSS gradient) shows on mobile
- Shader renders normally on desktop
- Blog/notes lists are left-aligned on mobile, right-aligned on desktop
