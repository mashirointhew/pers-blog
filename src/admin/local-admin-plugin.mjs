import { readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { dump, load } from 'js-yaml';

const collections = new Set(['posts', 'projects', 'links']);
const frontmatterPattern = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)([\s\S]*)$/;
const colorPattern = /^#[\da-f]{6}$/i;
const fonts = new Set(['DM Sans', 'Newsreader', 'DM Mono', 'Arial', 'Georgia', 'system-ui', 'monospace']);
const sectionIds = ['themes', 'featuredPosts', 'featuredProjects', 'featuredLinks', 'about'];

function send(res, status, value) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(value));
}

function isLoopbackRequest(req) {
  let host = '';
  try { host = new URL(`http://${req.headers.host ?? ''}`).hostname.replace(/^\[|\]$/g, '').toLowerCase(); } catch {}
  const remoteAddress = req.socket?.remoteAddress ?? '';
  if (!['::1', '127.0.0.1', '::ffff:127.0.0.1'].includes(remoteAddress)) return false;
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host.toLowerCase() === req.headers.host?.toLowerCase();
  } catch {
    return false;
  }
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 2_000_000) throw new Error('Request is too large.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function normalizeDate(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10);
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})(?:$|T)/);
    if (match) return match[1];
  }
  return value;
}

function isValidDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function parseEntry(text) {
  const match = text.match(frontmatterPattern);
  if (!match) throw new Error('Post has invalid frontmatter.');
  const data = load(match[1]);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Frontmatter must be an object.');
  for (const key of ['date', 'updated']) data[key] = normalizeDate(data[key]);
  return { data, body: match[2] };
}

function validUrl(value, optional = false) {
  if (optional && (value === '' || value === undefined)) return true;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function validateEntry(collection, data, body) {
  if (!collections.has(collection)) throw new Error('Unknown content collection.');
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Entry fields are missing.');
  if (!String(data.title ?? '').trim()) throw new Error('Title is required.');
  if (!String(data.description ?? '').trim()) throw new Error('Description is required.');
  if (!isValidDateOnly(normalizeDate(data.date))) throw new Error('Enter a valid date.');
  if (data.updated && !isValidDateOnly(normalizeDate(data.updated))) throw new Error('Enter a valid last updated date.');
  if (typeof data.draft !== 'boolean' || typeof data.featured !== 'boolean') throw new Error('Draft and featured must be set.');
  if (!Array.isArray(data.tags) || data.tags.some((tag) => typeof tag !== 'string')) throw new Error('Tags must be a list of text values.');
  if (typeof body !== 'string') throw new Error('Post body must be text.');
  if (collection === 'links' && !validUrl(data.url)) throw new Error('Links need a valid http or https URL.');
  if (collection === 'projects' && !['active', 'complete', 'archived'].includes(data.status)) throw new Error('Choose a valid project status.');
  if (collection !== 'links' && !validUrl(data.url, true)) throw new Error('URL must use http or https.');
  if (collection === 'projects' && !validUrl(data.repository, true)) throw new Error('Repository URL must use http or https.');
  if (collection === 'posts' && data.image && typeof data.image !== 'string') throw new Error('Image must be a path.');
  if (collection === 'projects' && data.image && typeof data.image !== 'string') throw new Error('Image must be a path.');
  if (collection === 'posts' && data.references !== undefined && (!Array.isArray(data.references) || data.references.some((item) => !item.title || !validUrl(item.url)))) {
    throw new Error('References need a title and valid URL.');
  }
  if (collection === 'links' && data.source !== undefined && typeof data.source !== 'string') throw new Error('Source must be text.');
}

function slugify(value) {
  const slug = value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!slug) throw new Error('Title must include letters or numbers to create a filename.');
  return slug;
}

function checkSettings(settings) {
  if (!settings || typeof settings !== 'object') throw new Error('Settings are missing.');
  const text = (value, label) => {
    if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`);
  };
  text(settings.site?.name, 'Site name');
  text(settings.site?.description, 'Site description');
  text(settings.site?.homeDescription, 'Homepage description');
  text(settings.site?.footerText, 'Footer text');
  for (const item of settings.site?.navigation ?? []) {
    text(item.label, 'Navigation label');
    if (typeof item.visible !== 'boolean' || !validHref(item.href)) throw new Error('Navigation items need a valid path or URL and visibility.');
  }
  for (const item of settings.site?.footerLinks ?? []) {
    text(item.label, 'Footer link label');
    if (!validHref(item.href)) throw new Error('Footer links need a valid path or URL.');
  }
  for (const group of ['dark', 'light']) {
    for (const key of ['paper', 'ink', 'muted', 'line', 'accent', 'wash', 'surface']) {
      if (!colorPattern.test(settings.theme?.[group]?.[key] ?? '')) throw new Error(`Choose a valid color for ${group} ${key}.`);
    }
  }
  for (const key of ['sans', 'serif', 'mono']) {
    if (!fonts.has(settings.theme?.fonts?.[key])) throw new Error(`Choose a supported ${key} font.`);
  }
  const layoutRanges = {
    shellWidthRem: [40, 110],
    sectionWidthRem: [35, 100],
    articleWidthRem: [30, 80],
    detailWidthRem: [35, 100],
    sidebarWidthRem: [10, 30],
    homeSidebarWidthRem: [10, 30],
    pageGapRem: [1, 12],
    sectionGapRem: [1, 12],
  };
  for (const [key, [minimum, maximum]] of Object.entries(layoutRanges)) {
    const value = settings.theme?.layout?.[key];
    if (!Number.isFinite(value) || value < minimum || value > maximum) throw new Error(`${key} must be between ${minimum} and ${maximum} rem.`);
  }
  const sections = settings.home?.sidebarSections;
  if (!Number.isInteger(settings.home?.recentPostLimit) || settings.home.recentPostLimit < 1 || settings.home.recentPostLimit > 24) throw new Error('Recent post count must be between 1 and 24.');
  if (!Array.isArray(sections) || sections.length !== sectionIds.length || new Set(sections.map((section) => section.id)).size !== sectionIds.length || sections.some((section) => !sectionIds.includes(section.id))) {
    throw new Error('Homepage sidebar sections are invalid.');
  }
  for (const section of sections) {
    text(section.title, 'Section title');
    if (typeof section.visible !== 'boolean') throw new Error('Section visibility must be set.');
  }
  for (const group of Object.values(settings.pages ?? {})) {
    for (const value of Object.values(group)) text(value, 'Page text');
  }
}

function validHref(value) {
  return typeof value === 'string' && ((value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') && !/[\u0000-\u001f]/.test(value)) || validUrl(value));
}

function normalizeEntry(collection, data) {
  const common = {
    title: data.title.trim(),
    description: data.description.trim(),
    date: normalizeDate(data.date),
    draft: data.draft,
  };
  if (collection === 'posts') return { ...common, ...(data.updated ? { updated: normalizeDate(data.updated) } : {}), featured: data.featured, tags: data.tags, ...(data.image ? { image: data.image } : {}), references: data.references ?? [] };
  if (collection === 'projects') return { ...common, featured: data.featured, status: data.status, ...(data.url ? { url: data.url } : {}), ...(data.repository ? { repository: data.repository } : {}), tags: data.tags, ...(data.image ? { image: data.image } : {}) };
  return { ...common, featured: data.featured, url: data.url, ...(data.source ? { source: data.source } : {}), tags: data.tags };
}

export default function localAdminPlugin() {
  return {
    name: 'local-site-admin',
    apply: 'serve',
    configureServer(server) {
      const root = resolve(server.config.root);
      // E2E runs point the local admin at a temporary copy so browser tests
      // can exercise file writes without touching the developer's content.
      const dataRoot = process.env.LOCAL_ADMIN_DATA_DIR
        ? resolve(process.env.LOCAL_ADMIN_DATA_DIR)
        : join(root, 'src');
      const settingsPath = join(dataRoot, 'data', 'site-settings.json');
      const contentRoot = join(dataRoot, 'content');

      const middleware = async (req, res, next) => {
        const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
        if ((pathname === '/admin' || pathname === '/admin/') && req.method === 'GET') {
          if (!isLoopbackRequest(req)) return send(res, 403, { error: 'The site control panel is available only from this local machine.' });
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Site control · Field Notes</title></head><body><div id="admin-root"></div><script type="module" src="/src/admin/main.ts"></script></body></html>`);
          return;
        }
        if (!pathname.startsWith('/__local_admin/api')) return next();
        if (!isLoopbackRequest(req)) return send(res, 403, { error: 'The local admin API only accepts requests from this local dev server.' });

        try {
          const route = pathname.slice('/__local_admin/api'.length) || '/';
          if (route === '/' && req.method === 'GET') {
            const entries = {};
            for (const collection of collections) {
              const directory = join(contentRoot, collection);
              const files = (await readdir(directory)).filter((file) => extname(file) === '.mdx').sort((a, b) => a.localeCompare(b));
              entries[collection] = await Promise.all(files.map(async (file) => ({ id: basename(file, extname(file)), ...parseEntry(await readFile(join(directory, file), 'utf8')) })));
            }
            return send(res, 200, { entries, settings: JSON.parse(await readFile(settingsPath, 'utf8')) });
          }

          if (route === '/content' && req.method === 'PUT') {
            const input = await readJson(req);
            const collection = input.collection;
            if (!collections.has(collection)) throw new Error('Unknown content collection.');
            const data = normalizeEntry(collection, input.data);
            validateEntry(collection, data, input.body);
            const id = input.id ? String(input.id) : slugify(data.title);
            if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Filename can only contain letters, numbers, dashes, and underscores.');
            const filePath = join(contentRoot, collection, `${id}.mdx`);
            const isNew = !input.id;
            if (isNew) {
              try { await readFile(filePath); throw new Error('A file with this title already exists.'); } catch (error) { if (error.message === 'A file with this title already exists.') throw error; }
            }
            const frontmatter = dump(data, { noRefs: true, lineWidth: -1, quotingType: '"', forceQuotes: false }).trimEnd();
            await writeFile(filePath, `---\n${frontmatter}\n---\n\n${input.body.replace(/^\s+|\s+$/g, '')}\n`, 'utf8');
            return send(res, 200, { id, message: 'Saved. Astro is refreshing the site preview.' });
          }

          if (route === '/content' && req.method === 'DELETE') {
            const input = await readJson(req);
            if (!collections.has(input.collection) || !/^[a-zA-Z0-9_-]+$/.test(input.id)) throw new Error('Invalid content path.');
            await unlink(join(contentRoot, input.collection, `${input.id}.mdx`));
            return send(res, 200, { message: 'Content deleted.' });
          }

          if (route === '/settings' && req.method === 'PUT') {
            const settings = await readJson(req);
            checkSettings(settings);
            await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
            return send(res, 200, { message: 'Settings saved. Astro is refreshing the site preview.' });
          }

          return send(res, 404, { error: 'Unknown local admin endpoint.' });
        } catch (error) {
          return send(res, 400, { error: error instanceof Error ? error.message : 'Unable to complete the request.' });
        }
      };
      server.middlewares.use(middleware);
      const stack = server.middlewares.stack;
      const layerIndex = stack.findIndex((layer) => layer.handle === middleware);
      if (layerIndex > 0) stack.unshift(...stack.splice(layerIndex, 1));
    },
  };
}
