import './admin.css';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

type CollectionName = 'posts' | 'projects' | 'links';
type Entry = { id: string; data: Record<string, any>; body: string };
type Settings = Record<string, any>;

const root = document.querySelector<HTMLDivElement>('#admin-root');
if (!root) throw new Error('Admin root element was not found.');

let activeTab = 'Overview';
let activeCollection: CollectionName = 'posts';
let selectedId: string | null = null;
let notice = '';
let errorMessage = '';
let savedSettings: Settings;
let entriesByCollection: Record<CollectionName, Entry[]>;

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const dateOnly = (value: unknown) => String(value ?? '').slice(0, 10);
const arrayText = (value: unknown) => Array.isArray(value) ? value.join(', ') : '';
const selectedEntry = () => selectedId ? entriesByCollection[activeCollection].find((entry) => entry.id === selectedId) ?? null : null;

async function api(path: string, method = 'GET', body?: unknown) {
  const response = await fetch(`/__local_admin/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'The request could not be completed.');
  return result;
}

async function refresh() {
  const data = await api('/');
  entriesByCollection = data.entries;
  savedSettings = data.settings;
}

function navButton(name: string, icon: string) {
  return `<button class="admin-nav-item ${activeTab === name ? 'is-active' : ''}" data-tab="${name}"><span>${icon}</span>${name}</button>`;
}

function field(label: string, name: string, value: unknown, type = 'text', hint = '') {
  const input = type === 'textarea'
    ? `<textarea id="${name}" name="${name}" rows="3">${escapeHtml(value)}</textarea>`
    : `<input id="${name}" name="${name}" type="${type}" value="${escapeHtml(value)}">`;
  return `<label class="admin-field"><span>${label}</span>${input}${hint ? `<small>${hint}</small>` : ''}</label>`;
}

function checkbox(label: string, name: string, checked: boolean) {
  return `<label class="admin-check"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''}><span>${label}</span></label>`;
}

function selectField(label: string, name: string, value: string, options: string[]) {
  return `<label class="admin-field"><span>${label}</span><select id="${name}" name="${name}">${options.map((option) => `<option ${value === option ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}</select></label>`;
}

function entryDefaults(collection: CollectionName): Entry {
  const date = new Date().toISOString().slice(0, 10);
  const data: Record<string, any> = { title: '', description: '', date, draft: true, featured: false, tags: [] };
  if (collection === 'projects') Object.assign(data, { status: 'active', url: '', repository: '', image: '' });
  if (collection === 'links') Object.assign(data, { url: '', source: '' });
  if (collection === 'posts') Object.assign(data, { updated: '', image: '', references: [] });
  return { id: '', data, body: '' };
}

function overview() {
  const counts = (['posts', 'projects', 'links'] as CollectionName[]).map((name) => {
    const items = entriesByCollection[name];
    const published = items.filter((item) => !item.data.draft).length;
    return `<button class="admin-stat" data-open-collection="${name}"><span>${name}</span><strong>${items.length}</strong><small>${published} published · ${items.length - published} drafts</small></button>`;
  }).join('');
  return `<section class="admin-welcome"><p class="admin-eyebrow">LOCAL WORKSPACE</p><h1>Shape the site<br><em>as you write.</em></h1><p>Manage your writing, projects, links, and the design system from one quiet workspace.</p><a class="admin-button admin-button-primary" href="/" target="_blank">Open site preview <span>↗</span></a></section>
    <section class="admin-stats">${counts}</section>
    <section class="admin-panel admin-activity"><div class="admin-panel-heading"><div><p class="admin-eyebrow">YOUR WORKSPACE</p><h2>Recently updated</h2></div><span class="admin-live"><i></i> Local and private</span></div>
      ${(['posts', 'projects', 'links'] as CollectionName[]).flatMap((collection) => entriesByCollection[collection].map((entry) => ({ ...entry, collection }))).sort((a, b) => String(b.data.date).localeCompare(String(a.data.date))).slice(0, 6).map((entry) => `<button class="admin-entry-row" data-edit="${entry.collection}:${entry.id}"><span class="admin-entry-type">${entry.collection.slice(0, -1)}</span><span class="admin-entry-name">${escapeHtml(entry.data.title)}</span><span class="admin-entry-meta">${entry.data.draft ? 'Draft' : 'Published'}</span><span class="admin-entry-arrow">↗</span></button>`).join('') || '<p class="admin-empty">Your content will show up here.</p>'}
    </section>`;
}

function collectionView() {
  const entry = selectedEntry() ?? entryDefaults(activeCollection);
  const data = entry.data;
  const name = activeCollection.slice(0, -1);
  const isLink = activeCollection === 'links';
  const isProject = activeCollection === 'projects';
  const references = Array.isArray(data.references) ? data.references.map((item: any) => `${item.title} | ${item.url}`).join('\n') : '';
  return `<div class="admin-workspace-heading"><div><p class="admin-eyebrow">CONTENT / ${activeCollection.toUpperCase()}</p><h1>${selectedId ? 'Edit' : 'New'} ${name}</h1></div><button class="admin-button" data-new-entry>＋ New ${name}</button></div>
    <div class="admin-content-layout"><aside class="admin-entry-list"><div class="admin-list-search"><input type="search" placeholder="Find ${activeCollection}…" data-filter-entries><span>⌕</span></div>
      ${entriesByCollection[activeCollection].map((item) => `<button class="admin-list-item ${item.id === selectedId ? 'is-selected' : ''}" data-select-id="${escapeHtml(item.id)}"><span class="admin-list-title">${escapeHtml(item.data.title || 'Untitled')}</span><span class="admin-list-subtitle">${item.data.draft ? 'Draft' : 'Published'} · ${escapeHtml(item.data.date)}</span></button>`).join('') || '<p class="admin-empty">No entries yet. Create your first one.</p>'}</aside>
      <section class="admin-editor-panel"><form id="content-form" class="admin-form" novalidate>
        <div class="admin-form-top"><span class="admin-status ${data.draft ? 'is-draft' : 'is-published'}">${data.draft ? 'Draft' : 'Published'}</span>${selectedId ? `<span class="admin-slug">/${escapeHtml(selectedId)}.mdx</span>` : '<span class="admin-slug">Filename is created from the title</span>'}</div>
        <div class="admin-form-grid">${field('Title', 'title', data.title, 'text', 'The title readers will see.')}${field('Publication date', 'date', String(data.date ?? '').slice(0, 10), 'date')}
          ${field('Description', 'description', data.description, 'textarea', 'A short summary for cards and search.')}
          ${field('Tags', 'tags', arrayText(data.tags), 'text', 'Separate tags with commas.')}
          ${isLink ? field('Destination URL', 'url', data.url, 'url') : ''}
          ${isLink ? field('Source', 'source', data.source) : ''}
          ${isProject ? selectField('Project status', 'status', data.status ?? 'active', ['active', 'complete', 'archived']) : ''}
          ${isProject ? field('Project URL', 'url', data.url, 'url') : ''}
          ${isProject ? field('Repository URL', 'repository', data.repository, 'url') : ''}
          ${!isLink ? field('Image path', 'image', data.image) : ''}
          ${activeCollection === 'posts' ? field('Last updated', 'updated', String(data.updated ?? '').slice(0, 10), 'date') : ''}
          ${activeCollection === 'posts' ? field('References', 'references', references, 'textarea', 'One per line: title | https://example.com') : ''}
        </div>
        ${!isLink ? `<div class="admin-body-editor"><div class="admin-preview-heading"><label for="body">${isProject ? 'Project story' : 'Post body'}</label><span>MARKDOWN</span></div><div class="admin-body-split"><textarea id="body" name="body" spellcheck="true" placeholder="Start writing…">${escapeHtml(entry.body)}</textarea><div class="admin-markdown-preview" data-preview><p class="admin-preview-empty">Your preview appears here as you write.</p></div></div></div>` : ''}
        <div class="admin-form-footer">${checkbox('Keep as draft', 'draft', Boolean(data.draft))}${checkbox('Feature on homepage', 'featured', Boolean(data.featured))}<div class="admin-form-actions">${selectedId ? '<button class="admin-button admin-button-danger" type="button" data-delete-entry>Delete</button>' : '<button class="admin-button admin-button-danger" type="button" data-discard-entry>Discard</button>'}<button class="admin-button admin-button-primary" type="submit">Save ${name}</button></div></div>
      </form></section></div>`;
}

function colorControls(group: 'dark' | 'light') {
  const labels: Record<string, string> = { paper: 'Page background', ink: 'Main text', muted: 'Muted text', line: 'Divider lines', accent: 'Accent', wash: 'Hover background', surface: 'Raised surface' };
  return `<div class="admin-color-grid">${Object.entries(labels).map(([key, label]) => `<label class="admin-color-field"><span class="admin-color-swatch" style="background:${savedSettings.theme[group][key]}"></span><span>${label}</span><input type="color" name="theme.${group}.${key}" value="${savedSettings.theme[group][key]}"><code>${savedSettings.theme[group][key]}</code></label>`).join('')}</div>`;
}

function settingsView() {
  const settings = savedSettings;
  return `<div class="admin-workspace-heading"><div><p class="admin-eyebrow">YOUR SITE / SETTINGS</p><h1>Site & design</h1></div><button class="admin-button admin-button-primary" form="settings-form" type="submit">Save all settings</button></div>
    <form id="settings-form" class="admin-settings-form" novalidate>
      <section class="admin-panel"><div class="admin-panel-heading"><div><p class="admin-eyebrow">IDENTITY</p><h2>Site details</h2></div><span class="admin-panel-icon">✳</span></div><div class="admin-settings-grid">${field('Site name', 'site.name', settings.site.name)}${field('Default description', 'site.description', settings.site.description, 'textarea')}${field('Homepage note', 'site.homeDescription', settings.site.homeDescription, 'textarea')}${field('Footer text', 'site.footerText', settings.site.footerText, 'text', 'Use {year} and {name} as placeholders.')}${field('Recent posts shown', 'home.recentPostLimit', settings.home.recentPostLimit, 'number')}</div></section>
      <section class="admin-panel"><div class="admin-panel-heading"><div><p class="admin-eyebrow">PAGE COPY</p><h2>Headlines & descriptions</h2></div></div><div class="admin-page-copy-grid">${Object.entries(settings.pages).map(([page, values]: [string, any]) => `<fieldset class="admin-page-fields"><legend>${escapeHtml(page)}</legend>${Object.entries(values).map(([key, value]) => field(key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`), `pages.${page}.${key}`, value, String(value).length > 70 ? 'textarea' : 'text')).join('')}</fieldset>`).join('')}</div></section>
      <section class="admin-panel"><div class="admin-panel-heading"><div><p class="admin-eyebrow">NAVIGATION</p><h2>Header links</h2></div><button class="admin-button admin-button-small" type="button" data-add-row="navigation">＋ Add link</button></div><div class="admin-repeat-list" data-repeat-list="navigation">${settings.site.navigation.map((item: any, index: number) => `<div class="admin-repeat-row"><label class="admin-field"><span>Label</span><input name="navigation.${index}.label" value="${escapeHtml(item.label)}"></label><label class="admin-field"><span>Path or URL</span><input name="navigation.${index}.href" value="${escapeHtml(item.href)}"></label>${checkbox('Visible', `navigation.${index}.visible`, item.visible)}<button type="button" class="admin-icon-button" data-remove-row="navigation.${index}" aria-label="Remove navigation link">×</button></div>`).join('')}</div></section>
      <section class="admin-panel"><div class="admin-panel-heading"><div><p class="admin-eyebrow">FOOTER</p><h2>Footer links</h2></div><button class="admin-button admin-button-small" type="button" data-add-row="footerLinks">＋ Add link</button></div><div class="admin-repeat-list" data-repeat-list="footerLinks">${settings.site.footerLinks.map((item: any, index: number) => `<div class="admin-repeat-row"><label class="admin-field"><span>Label</span><input name="footerLinks.${index}.label" value="${escapeHtml(item.label)}"></label><label class="admin-field"><span>Path or URL</span><input name="footerLinks.${index}.href" value="${escapeHtml(item.href)}"></label><button type="button" class="admin-icon-button" data-remove-row="footerLinks.${index}" aria-label="Remove footer link">×</button></div>`).join('')}</div></section>
      <section class="admin-panel"><div class="admin-panel-heading"><div><p class="admin-eyebrow">HOMEPAGE</p><h2>Sidebar sections</h2><p>Move sections to set their order. Featured items are selected in each content editor.</p></div></div><div class="admin-section-order" data-section-order>${settings.home.sidebarSections.map((section: any, index: number) => `<div class="admin-section-row" data-section-id="${section.id}"><span class="admin-drag-handle">⠿</span><span class="admin-section-name">${escapeHtml(section.title)}</span>${checkbox('Show', `section.${index}.visible`, section.visible)}<label class="admin-section-title"><span>Heading</span><input name="section.${index}.title" value="${escapeHtml(section.title)}"></label><div class="admin-order-actions"><button type="button" data-move-section="${index}:up" ${index === 0 ? 'disabled' : ''} aria-label="Move up">↑</button><button type="button" data-move-section="${index}:down" ${index === settings.home.sidebarSections.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button></div></div>`).join('')}</div></section>
      <section class="admin-panel"><div class="admin-panel-heading"><div><p class="admin-eyebrow">COLOR SYSTEM</p><h2>Light and dark themes</h2><p>Each color updates across the site wherever that design token is used.</p></div></div><h3 class="admin-subheading">Dark</h3>${colorControls('dark')}<h3 class="admin-subheading">Light</h3>${colorControls('light')}</section>
      <section class="admin-panel"><div class="admin-panel-heading"><div><p class="admin-eyebrow">TYPE & LAYOUT</p><h2>Design proportions</h2></div></div><div class="admin-settings-grid">${selectField('Sans font', 'theme.fonts.sans', settings.theme.fonts.sans, ['DM Sans', 'Arial', 'system-ui'])}${selectField('Serif font', 'theme.fonts.serif', settings.theme.fonts.serif, ['Newsreader', 'Georgia'])}${selectField('Monospace font', 'theme.fonts.mono', settings.theme.fonts.mono, ['DM Mono', 'monospace'])}${Object.entries(settings.theme.layout).map(([key, value]: [string, any]) => {
        const ranges: Record<string, string> = { shellWidthRem: '40–110 rem', sectionWidthRem: '35–100 rem', articleWidthRem: '30–80 rem', detailWidthRem: '35–100 rem', sidebarWidthRem: '10–30 rem', homeSidebarWidthRem: '10–30 rem', pageGapRem: '1–12 rem', sectionGapRem: '1–12 rem' };
        return field(key.replace(/Rem$/, '').replace(/([A-Z])/g, ' $1'), `theme.layout.${key}`, value, 'number', `Allowed range: ${ranges[key]}.`);
      }).join('')}</div></section>
    </form>`;
}

function featuredView() {
  const categories: [CollectionName, string][] = [['posts', 'Posts'], ['projects', 'Projects'], ['links', 'Links']];
  return `<div class="admin-workspace-heading"><div><p class="admin-eyebrow">HOMEPAGE / CURATION</p><h1>Featured content</h1><p>Choose what appears in the homepage feature sections.</p></div></div><div class="admin-featured-grid">${categories.map(([collection, label]) => `<section class="admin-panel"><div class="admin-panel-heading"><div><p class="admin-eyebrow">FEATURED</p><h2>${label}</h2></div><span class="admin-featured-count">${entriesByCollection[collection].filter((entry) => entry.data.featured && !entry.data.draft).length} live</span></div>${entriesByCollection[collection].map((entry) => `<button type="button" class="admin-featured-item" data-featured="${collection}:${entry.id}" role="switch" aria-checked="${Boolean(entry.data.featured)}" aria-label="Feature ${escapeHtml(entry.data.title)} on the homepage" ${entry.data.draft ? 'disabled title="Publish this draft before featuring it"' : ''}><span><strong>${escapeHtml(entry.data.title)}</strong><small>${entry.data.draft ? 'Draft · publish before featuring' : entry.data.description}</small></span><span class="admin-featured-toggle" aria-hidden="true"></span></button>`).join('') || '<p class="admin-empty">No content in this collection yet.</p>'}</section>`).join('')}</div>`;
}

function render() {
  root!.innerHTML = `<div class="admin-app"><aside class="admin-sidebar"><a class="admin-brand" href="/admin"><span class="admin-brand-mark">f.</span><span>FIELD NOTES<small>STUDIO</small></span></a><div class="admin-local-tag"><i></i> LOCAL WORKSPACE</div><nav class="admin-navigation"><p>WORKSPACE</p>${navButton('Overview', '⌂')}${navButton('Posts', '¶')}${navButton('Projects', '▧')}${navButton('Links', '↗')}${navButton('Featured', '✳')}<p class="admin-nav-spacer">SITE</p>${navButton('Site & design', '◒')}</nav><a class="admin-site-link" href="/" target="_blank"><span>↗</span> View live preview</a><div class="admin-sidebar-foot"><span>Changes save to this project</span><span>Astro · Static site</span></div></aside><main class="admin-main"><header class="admin-topbar"><div class="admin-breadcrumb">Workspace <span>/</span> ${escapeHtml(activeTab)}</div><div class="admin-top-actions"><span class="admin-local-tag"><i></i> Local only</span><a href="/" target="_blank" class="admin-view-link">Preview site ↗</a></div></header><div class="admin-page-content">${errorMessage ? `<div class="admin-alert is-error">${escapeHtml(errorMessage)}<button data-dismiss-alert>×</button></div>` : ''}${notice ? `<div class="admin-alert is-success">${escapeHtml(notice)}<button data-dismiss-alert>×</button></div>` : ''}${activeTab === 'Overview' ? overview() : activeTab === 'Site & design' ? settingsView() : activeTab === 'Featured' ? featuredView() : collectionView()}</div></main></div>`;
  bindEvents();
}

function formValues(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form).entries());
}

function currentEntryData(form: HTMLFormElement) {
  const values = formValues(form);
  const tags = String(values.tags ?? '').split(',').map((tag) => tag.trim()).filter(Boolean);
  const data: Record<string, any> = {
    title: values.title,
    description: values.description,
    date: values.date,
    draft: form.elements.namedItem('draft') instanceof HTMLInputElement && (form.elements.namedItem('draft') as HTMLInputElement).checked,
    featured: form.elements.namedItem('featured') instanceof HTMLInputElement && (form.elements.namedItem('featured') as HTMLInputElement).checked,
    tags,
  };
  if (activeCollection === 'posts') {
    data.updated = values.updated || undefined;
    data.image = values.image || undefined;
    data.references = String(values.references ?? '').split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
      const [title, ...url] = line.split('|');
      return { title: title.trim(), url: url.join('|').trim() };
    });
  } else if (activeCollection === 'projects') {
    data.status = values.status;
    data.url = values.url || undefined;
    data.repository = values.repository || undefined;
    data.image = values.image || undefined;
  } else {
    data.url = values.url;
    data.source = values.source || undefined;
  }
  return { data, body: String(values.body ?? '') };
}

function setByPath(object: any, path: string, value: unknown) {
  const parts = path.split('.');
  const final = parts.pop()!;
  const parent = parts.reduce((node, key) => node[key] ??= {}, object);
  parent[final] = value;
}

function collectSettings(form: HTMLFormElement) {
  const settings = structuredClone(savedSettings);
  const assign = (path: string, value: unknown) => {
    if (path.startsWith('theme.')) setByPath(settings, path, value);
    else if (path.startsWith('pages.')) setByPath(settings, path, value);
    else if (path.startsWith('section.')) {
      const [, indexText, key] = path.split('.');
      const index = Number(indexText);
      if (key === 'title') settings.home.sidebarSections[index].title = value;
      if (key === 'visible') settings.home.sidebarSections[index].visible = value;
    } else if (path.startsWith('navigation.') || path.startsWith('footerLinks.')) {
      const [group, indexText, key] = path.split('.');
      const list = group === 'navigation' ? settings.site.navigation : settings.site.footerLinks;
      const index = Number(indexText);
      if (key === 'visible') list[index].visible = value;
      else list[index][key] = value;
    } else if (path.startsWith('site.')) setByPath(settings, path, value);
    else if (path.startsWith('home.')) setByPath(settings, path, value);
  };
  for (const [path, raw] of Object.entries(formValues(form))) {
    const input = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${CSS.escape(path)}"]`);
    const value = input instanceof HTMLInputElement && input.type === 'number' ? Number(raw) : raw;
    assign(path, value);
  }
  for (const input of form.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) assign(input.name, input.checked);
  for (const group of ['navigation', 'footerLinks'] as const) {
    const list = settings.site[group];
    const existing = [...form.querySelectorAll<HTMLInputElement>(`[name^="${group}."]`)].map((input) => input.name.split('.')[1]);
    if (existing.length) settings.site[group] = list.filter((_item: unknown, index: number) => existing.includes(String(index)));
  }
  return settings;
}

function bindEvents() {
  root!.querySelectorAll<HTMLElement>('[data-tab]').forEach((button) => button.addEventListener('click', () => {
    activeTab = button.dataset.tab!;
    if (activeTab === 'Posts' || activeTab === 'Projects' || activeTab === 'Links') {
      activeCollection = activeTab.toLowerCase() as CollectionName;
    }
    selectedId = null;
    errorMessage = '';
    render();
  }));
  root!.querySelectorAll<HTMLElement>('[data-open-collection]').forEach((button) => button.addEventListener('click', () => {
    activeCollection = button.dataset.openCollection as CollectionName;
    activeTab = activeCollection[0].toUpperCase() + activeCollection.slice(1);
    selectedId = null;
    render();
  }));
  root!.querySelectorAll<HTMLElement>('[data-edit]').forEach((button) => button.addEventListener('click', () => {
    const [collection, id] = button.dataset.edit!.split(':') as [CollectionName, string];
    activeCollection = collection;
    activeTab = collection[0].toUpperCase() + collection.slice(1);
    selectedId = id;
    render();
  }));
  root!.querySelectorAll<HTMLElement>('[data-select-id]').forEach((button) => button.addEventListener('click', () => {
    selectedId = button.dataset.selectId!;
    errorMessage = '';
    render();
  }));
  root!.querySelector<HTMLElement>('[data-new-entry]')?.addEventListener('click', () => {
    selectedId = null;
    errorMessage = '';
    render();
  });
  root!.querySelector<HTMLElement>('[data-discard-entry]')?.addEventListener('click', () => {
    selectedId = null;
    notice = '';
    errorMessage = '';
    render();
  });
  root!.querySelector<HTMLElement>('[data-dismiss-alert]')?.addEventListener('click', () => {
    notice = '';
    errorMessage = '';
    render();
  });
  root!.querySelector<HTMLInputElement>('[data-filter-entries]')?.addEventListener('input', (event) => {
    const term = (event.currentTarget as HTMLInputElement).value.toLowerCase();
    root!.querySelectorAll<HTMLElement>('[data-select-id]').forEach((item) => {
      item.hidden = !item.textContent?.toLowerCase().includes(term);
    });
  });
  root!.querySelector<HTMLFormElement>('#content-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const { data, body } = currentEntryData(form);
    try {
      const result = await api('/content', 'PUT', { collection: activeCollection, id: selectedId, data, body });
      await refresh();
      selectedId = result.id;
      notice = result.message;
      errorMessage = '';
      render();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unable to save content.';
      render();
    }
  });
  root!.querySelector<HTMLElement>('[data-delete-entry]')?.addEventListener('click', async () => {
    if (!selectedId || !confirm(`Delete “${selectedEntry()?.data.title}” permanently?`)) return;
    try {
      await api('/content', 'DELETE', { collection: activeCollection, id: selectedId });
      await refresh();
      selectedId = null;
      notice = 'Entry deleted.';
      render();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unable to delete content.';
      render();
    }
  });
  const body = root!.querySelector<HTMLTextAreaElement>('#body');
  const preview = root!.querySelector<HTMLElement>('[data-preview]');
  const updatePreview = async () => {
    if (!body || !preview) return;
    const markdown = await marked.parse(body.value);
    preview.innerHTML = DOMPurify.sanitize(markdown);
    preview.classList.toggle('is-empty', !body.value.trim());
  };
  body?.addEventListener('input', updatePreview);
  if (body?.value) void updatePreview();

  root!.querySelectorAll<HTMLButtonElement>('[data-featured]').forEach((button) => button.addEventListener('click', async () => {
    const [collection, id] = button.dataset.featured!.split(':') as [CollectionName, string];
    const entry = entriesByCollection[collection].find((item) => item.id === id);
    if (!entry) return;
    const featured = button.getAttribute('aria-checked') !== 'true';
    button.disabled = true;
    try {
      await api('/content', 'PUT', { collection, id, data: { ...entry.data, date: dateOnly(entry.data.date), updated: entry.data.updated ? dateOnly(entry.data.updated) : undefined, featured, tags: entry.data.tags ?? [] }, body: entry.body });
      await refresh();
      notice = 'Featured selection saved.';
      render();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unable to update featured content.';
      render();
    }
  }));

  const settingsForm = root!.querySelector<HTMLFormElement>('#settings-form');
  settingsForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const settings = collectSettings(settingsForm);
      await api('/settings', 'PUT', settings);
      await refresh();
      notice = 'Settings saved. Astro is refreshing the site preview.';
      errorMessage = '';
      render();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unable to save settings.';
      render();
    }
  });
  settingsForm?.querySelectorAll<HTMLInputElement>('input[type="color"]').forEach((input) => input.addEventListener('input', () => {
    const swatch = input.parentElement?.querySelector<HTMLElement>('.admin-color-swatch');
    const hex = input.parentElement?.querySelector<HTMLElement>('code');
    if (swatch) swatch.style.background = input.value;
    if (hex) hex.textContent = input.value;
  }));
  settingsForm?.querySelectorAll<HTMLElement>('[data-move-section]').forEach((button) => button.addEventListener('click', () => {
    const [indexText, direction] = button.dataset.moveSection!.split(':');
    const index = Number(indexText);
    const target = index + (direction === 'up' ? -1 : 1);
    if (target < 0 || target >= savedSettings.home.sidebarSections.length) return;
    [savedSettings.home.sidebarSections[index], savedSettings.home.sidebarSections[target]] = [savedSettings.home.sidebarSections[target], savedSettings.home.sidebarSections[index]];
    render();
  }));
  settingsForm?.querySelectorAll<HTMLElement>('[data-add-row]').forEach((button) => button.addEventListener('click', () => {
    const name = button.dataset.addRow;
    if (name === 'navigation') savedSettings.site.navigation.push({ label: 'New page', href: '/', visible: true });
    if (name === 'footerLinks') savedSettings.site.footerLinks.push({ label: 'New link', href: '/' });
    render();
  }));
  settingsForm?.querySelectorAll<HTMLElement>('[data-remove-row]').forEach((button) => button.addEventListener('click', () => {
    const [group, indexText] = button.dataset.removeRow!.split('.');
    const list = group === 'navigation' ? savedSettings.site.navigation : savedSettings.site.footerLinks;
    list.splice(Number(indexText), 1);
    render();
  }));
}

try {
  await refresh();
  render();
} catch (error) {
  root.innerHTML = `<main class="admin-load-error"><span>f.</span><h1>Could not open your workspace.</h1><p>${escapeHtml(error instanceof Error ? error.message : 'Start the Astro dev server and reload /admin.')}</p><button onclick="location.reload()">Try again</button></main>`;
}
