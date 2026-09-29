import { defineCollection, z } from 'astro:content';

const sharedFields = {
  title: z.string(),
  description: z.string(),
  date: z.coerce.date(),
  draft: z.boolean().default(false),
};

const posts = defineCollection({
  type: 'content',
  schema: z.object({
    ...sharedFields,
    updated: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    image: z.string().optional(),
    references: z.array(z.object({ title: z.string(), url: z.string().url() })).default([]),
  }),
});

const projects = defineCollection({
  type: 'content',
  schema: z.object({
    ...sharedFields,
    status: z.enum(['active', 'complete', 'archived']).default('complete'),
    url: z.string().url().optional(),
    repository: z.string().url().optional(),
    tags: z.array(z.string()).default([]),
    image: z.string().optional(),
  }),
});

const links = defineCollection({
  type: 'content',
  schema: z.object({
    ...sharedFields,
    url: z.string().url(),
    source: z.string().optional(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { posts, projects, links };
