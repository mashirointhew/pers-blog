import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getPublishedPosts, postPath } from '../lib/content';
import { siteSettings } from '../lib/site-settings';

export const prerender = true;

export const GET: APIRoute = async (context) => {
  const posts = await getPublishedPosts();

  return rss({
    title: siteSettings.site.name,
    description: siteSettings.site.description,
    site: context.site ?? 'https://pers-blog.pages.dev',
    items: posts.map(({ data, id }) => ({
      title: data.title,
      description: data.description,
      pubDate: data.date,
      link: postPath(id),
    })),
  });
};
