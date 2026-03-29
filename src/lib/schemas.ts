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
