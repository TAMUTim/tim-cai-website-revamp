import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { Component } from 'svelte';
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
    default: Component<any>;
    metadata: Record<string, unknown>;
}

type GlobImport = Record<string, () => Promise<unknown>>;

export async function loadMarkdownContent<T>(
    glob: GlobImport,
    schema: z.ZodType<T>
): Promise<T[]> {
    const entries = Object.entries(glob);

    const results = await Promise.all(
        entries.map(async ([path, resolver]) => {
            const slug = extractSlug(path);
            if (!slug) return null;

            const module = await resolver() as MdsvexModule;
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

    return results.filter((item): item is NonNullable<typeof item> => item !== null) as T[];
}

export async function resolveContentBySlug(
    glob: GlobImport,
    slug: string
): Promise<{ component: Component<any>; frontmatter: Record<string, string> }> {
    for (const [path, resolver] of Object.entries(glob)) {
        if (extractSlug(path) === slug) {
            const module = await resolver() as MdsvexModule;
            if (!module.metadata.published) {
                throw error(404);
            }
            return {
                component: module.default,
                frontmatter: module.metadata as Record<string, string>
            };
        }
    }
    throw error(404);
}
