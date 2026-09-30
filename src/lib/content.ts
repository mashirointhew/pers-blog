import { getCollection } from 'astro:content';

export async function getPublishedPosts() {
  return (await getCollection('posts', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  );
}

export async function getPublishedProjects() {
  return (await getCollection('projects', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  );
}

export async function getPublishedLinks() {
  return (await getCollection('links', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  );
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'long' }).format(date);
}

export function contentSlug(id: string) {
  return id.replace(/\.(md|mdx)$/, '');
}

export function postPath(id: string) {
  return `/blog/${contentSlug(id)}/`;
}

export function projectPath(id: string) {
  return `/projects/${contentSlug(id)}/`;
}

export function tagPath(tag: string) {
  return `/tags/${encodeURIComponent(tag)}/`;
}

export function readingTime(body: string) {
  return Math.max(1, Math.ceil(body.trim().split(/\s+/).length / 200));
}

export async function getTagMap() {
  const posts = await getPublishedPosts();
  return posts.reduce<Record<string, typeof posts>>((map, post) => {
    post.data.tags.forEach((tag) => (map[tag] ??= []).push(post));
    return map;
  }, {});
}
