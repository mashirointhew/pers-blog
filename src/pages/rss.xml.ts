import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getPosts, postSlug } from '../lib/posts';

export const prerender = true;

export const GET: APIRoute = async (context) => {
  const posts = await getPosts();

  return rss({
    title: 'Field Notes',
    description: 'A personal blog about making things with care.',
    site: context.site ?? 'https://pers-blog.pages.dev',
    items: posts.map(({ data, id }) => ({
      title: data.title,
      description: data.description,
      pubDate: data.date,
      link: `/blog/${postSlug(id)}/`,
    })),
  });
};
