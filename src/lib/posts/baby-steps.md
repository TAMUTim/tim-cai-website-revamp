---
title: 'Baby Steps in the Wretched World of Javascript'
slug: 'baby-steps'
date: '2024-06-27'
author: 'Tim Cai'
published: true
readTime: 4
---

There is a point in every Software Engineer's life, a bit like a mid-life crisis,
where you are convinced that making a personal website will somehow solve all your problems.
For me, that point was around a month ago, and behold! This website was born!
I took heavy inspiration from the great [Anthony Fu](http://www.antfu.me) and his
ever-so-clean and polished website. There are a couple of features that his has that I want to include in mine;
however, due to a different tech stack (and probably skill diff), it just isn't working out.
I'll break those down in a second, but first I want to give a quick introduction to how I went about creating the site!

There were a couple of goals I had in mind when I started on this, namely it had to:
1. Use a new (and modern!) Javascript framework
2. Be reusable for the next couple of years
3. Look decent

## [Svelte](https://svelte.dev/)
There was a poll on one of the web development subreddits I follow that had a list of web frameworks, and the overall
developer satisfaction with them. Svelte was first, with users citing its ease of use, responsiveness, and the fact that
it just made sense. I mean, what else can you really ask for? 

Working with svelte was great but some of the more complicated features were a little harder to get done. For instance,
this is the code to automatically render this (and all) posts.

```ts
import type {PageServerLoad} from "./$types";

export const load: PageServerLoad = async({ url }) => {
	const module = import.meta.glob('/src/posts/*.md');

	const postPromises = Object.entries(module).map(([path, resolver]) =>
		resolver().then(
			(post) => ({
				slug: path.match(/([\w-]+)\.(svelte\.md|md|svx)/i)?.[1] 
                ?? null, 
                ...(post as unknown as App.MdsvexFile).metadata
			} as App.BlogPost)
		)
	);

	const posts = await Promise.all(postPromises);
	const publishedPosts = posts.filter((post) => post.published)

	publishedPosts.sort((a, b) => 
      (new Date(a.date) > new Date(b.date) ? -1 : 1)
    );

	return { posts: publishedPosts };
}
```

The regex does make the code look a little more intimidating than it actually is. It pulls all markdown files in my posts
directory, creates a BlogPost interface as defined in my `app.d.ts` with the appropriate slug (name of file) and metadata.
I had no idea that markdown did this, but you can include a frontmatter part, and it acts like metadata. For instance,
the frontmatter for this post looks like this:

```
---
title: 'Baby Steps in the Wretched World of Javascript'
slug: 'baby-steps'
date: '2024-06-27'
author: 'Tim Cai'
published: true
readTime: 4
---
```

It gets turned into a JSON object, added to our BlogPost interface, and put in a list of all blog posts. Then we return
them all sorted by date. Which our blog page can receive, sort by year, and then display accordingly. Now this is done
through the `+page.server.ts` file. It's a Svelte idiosyncrasy that runs in the server before anything is rendered, 
which is exactly what we want. Then all we need is to add an `export let data` in our `+page.svelte` to get the 
`{ posts: publishedPosts }` we returned. Note that this is just in the blog page, and actually rendering the `slug` we
want to do the same, but retrieve the markdown file as a Svelte component, which is done through the `mdsvex` package. 

## [p5-svelte](https://p5js.org/)
You might have noticed the background and how awesome and amazing and wonderful it is. It's not too loud, but looks
nice while maintaining a somewhat professional, readable website. The code itself was taken from 
[Anthony Fu](https://github.com/antfu/antfu.me/blob/main/src/components/ArtDots.vue), with a
couple of very minor adjustments to increase range of motion. The "art" itself is rendered through the 
[`p5`](https://p5js.org/) package and made easier to work with through 
[`p5-svelte`](https://github.com/tonyketcham/p5-svelte). It's meant to be a more user-friendly graphics library that 
doesn't absolutely annihilate memory, and for my use case it more than fulfilled expectations. We render a canvas that
is the size of the internal window, except for the height which is rendered like this:

```typescript
let body = document.body;
let html = document.documentElement;

let w = window.outerWidth;
let h = Math.max(
  body.scrollHeight, body.offsetHeight,
  html.clientHeight, html.scrollHeight, html.offsetHeight
);
```

Which is quite unsatisfying, but gets the job done. From there we load in enough coordinates to fill the screen, 
like a dotted grid, and apply a noise on the point from the following formula:

```ts
function getForceOnPoint(x: number, y: number, z: number) {
    return (p5.noise(x / SCALE, y / SCALE, z) -0.5) * 2 * p5.TWO_PI;
}
```

With the `x`, `y` being coordinates, and `z` being a random number. The TWO_PI is not important, and any constant around
6 will achieve the same effect. From there, we put the noise into a `cos` and out pops pseudo-random 2D waves - pretty neat!
This is what the main drawing loop renders:

```ts
p5.draw = () => {
    p5.background('#ffffff');
    const t = +new Date() / 10000;

    for (const p of points) {
        const { x, y } = p;
        const rad = getForceOnPoint(x, y, t);
        const length = 
          (p5.noise(x / SCALE, y / SCALE, t * 2) + 0.5) * LENGTH;
        const nx = x + p5.cos(rad) * length;
        const ny = y + p5.cos(rad) * length;
        const r2 = Math.abs(p5.cos(rad)) * 255;
        p5.stroke(r2, r2, r2, 
          (Math.abs(p5.cos(rad)) * 0.8 + 0.2) * p.opacity * 255);
        p5.circle(nx, ny - offsetY, 2);
    }
}
```

It looks quite visually appealing I think, but I have seen some performance issues. Sometimes, I think it's when 
a live refresh occurs in development, it becomes quite laggy and not smooth at all. While a page refresh usually fixes
the issue, I wonder if there is something that could be adjusted to reduce those issues. Another gripe of mine is the 
parallax. For some reason I can't quite get the parallax going on the background. I believe it is something to do with
Svelte rendering, but it's a feature that can be added in later. 

## Thoughts
Overall the website was quite a daunting undertaking, especially since it was the first time I've worked with a modern web framework. 
Either way, this is a project I'd like to take further, like a seasonal thing.
The two highlighted sections are just pieces of a much larger story that I'd like to fully share one day. Until then! 