# Field Notes

Field Notes is a static personal site built with Astro. Writing, projects, and saved links are Markdown or MDX files in the repository. Astro generates the pages, and Pagefind creates the search index during production builds.

## Requirements and setup

- Node.js 22.12 or later
- npm

```sh
npm install
npm run dev
```

Astro prints the local development URL (usually `http://localhost:4321`). Search needs the generated Pagefind index, so test it with `npm run build` followed by `npm run preview`.

## Content

### Writing

Create a draft article with:

```sh
npm run new -- "A useful note"
```

This creates `src/content/posts/a-useful-note.mdx`. Edit the file directly and set `draft: false` when ready. The article filename becomes its URL slug. Published articles support `title`, `description`, `date`, optional `updated`, `tags`, `draft`, and optional `image` fields.

### Projects

Add a Markdown or MDX file under `src/content/projects/`. The filename determines the project detail URL under `/projects/`.

```yaml
---
title: "A small project"
description: "What it does and why it exists."
date: 2026-09-29
draft: false
status: active
url: https://example.org/project
repository: https://github.com/example/project
tags:
  - tools
---

Describe the project, the process, or what you learned.
```

`status` may be `active`, `complete`, or `archived`. `url`, `repository`, and tags are optional. The project appears in the `/projects` index and gets a static detail page.

### Links

Add a Markdown or MDX file under `src/content/links/`. Each published file adds a curated link to `/links`; it does not create a separate detail page.

```yaml
---
title: "An article worth saving"
description: "A note on what makes this useful."
date: 2026-09-29
draft: false
url: https://example.org/article
source: Example publication
tags:
  - reading
---
```

The `url` field is required. `source` and tags are optional. Both Projects and Links support `draft: true` while preparing entries; drafts are excluded from the published pages.

## Project structure

```text
src/
|-- components/       Shared site components
|-- content/
|   |-- posts/        Articles
|   |-- projects/     Project entries
|   `-- links/        Curated external links
|-- layouts/          Shared document layout and metadata
|-- lib/              Post query and URL helpers
|-- pages/            Static routes and collection pages
|-- styles/           Theme, typography, and layout styles
`-- content.config.ts Validated collection schemas
public/               Static files served as-is
scripts/              Post creation helper
```

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Astro's local development server |
| `npm run check` | Check Astro and TypeScript diagnostics |
| `npm run lint` | Run ESLint |
| `npm run format` | Check formatting with Prettier |
| `npm run build` | Generate the static site and Pagefind index |
| `npm run preview` | Preview the production build |
| `npm run new -- "Post title"` | Create a draft MDX article |

The build generates the sitemap and search index. RSS is available at `/rss.xml`. The header links to Writing, Projects, Links, and Search.

## Appearance

The dark theme uses a warm charcoal base (`#171916`) with a faint olive-tinted glow, soft gray dividers, and a restrained lime accent. This keeps the page dark without the harsh contrast of pure black and makes the reading surface feel less flat. Readers can switch to the light theme with the header control. Theme tokens and page styling are in `src/styles/global.css`.

## Configuration and deployment

The default production URL is `https://pers-blog.pages.dev`. Set `SITE_URL` to the site's actual public origin if the Pages project uses a different name or a custom domain. Astro uses it for canonical URLs, the sitemap, and RSS.

### Cloudflare Pages deployment

1. Push the repository to GitHub and connect it in Cloudflare under **Workers & Pages → Create application → Pages → Connect to Git**.
2. Choose `main` as the production branch (the current GitHub branch).
3. Set the build command to `npm run build` and the build output directory to `dist`.
4. Set the `NODE_VERSION` environment variable to `22.12.0`. Set `SITE_URL` to the Pages URL or custom domain once known.
5. Enable pull request builds to get Pages preview deployments.

The GitHub Actions workflow checks Astro/TypeScript and builds on pushes and pull requests targeting `main`. Cloudflare's Git integration publishes successful production-branch pushes and creates previews for pull requests. The repository can remain private. No backend, database, or secrets are needed for this static site.

## Documentation

- [Astro documentation](https://docs.astro.build/)
- [Astro content collections](https://docs.astro.build/en/guides/content-collections/)
- [Astro routing](https://docs.astro.build/en/guides/routing/)
- [Pagefind documentation](https://pagefind.app/docs/)
