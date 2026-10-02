import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import { defineConfig } from 'astro/config';
import localAdminPlugin from './src/admin/local-admin-plugin.mjs';

export default defineConfig({
  site: process.env.SITE_URL ?? 'https://pers-blog.pages.dev',
  trailingSlash: 'always',
  integrations: [mdx(), tailwind(), sitemap()],
  vite: {
    plugins: [localAdminPlugin()],
    // The admin entry is injected by a dev-only middleware, so Vite's
    // dependency scanner may miss its imports and serve stale optimizer URLs.
    optimizeDeps: { include: ['marked', 'dompurify'] },
  },
  markdown: { shikiConfig: { theme: 'github-dark' } },
});
