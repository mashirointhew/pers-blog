import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: process.env.SITE_URL ?? 'https://pers-blog.pages.dev',
  integrations: [mdx(), tailwind(), sitemap()],
  markdown: { shikiConfig: { theme: 'github-dark' } },
});
