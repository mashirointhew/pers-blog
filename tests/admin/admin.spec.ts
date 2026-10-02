import { cp, mkdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { adminDataDir } from './paths';

const projectRoot = resolve(import.meta.dirname, '../..');

async function resetFixture() {
  await rm(join(adminDataDir, 'content'), { recursive: true, force: true });
  await rm(join(adminDataDir, 'data'), { recursive: true, force: true });
  await mkdir(adminDataDir, { recursive: true });
  await cp(join(projectRoot, 'src', 'content'), join(adminDataDir, 'content'), { recursive: true });
  await cp(join(projectRoot, 'src', 'data'), join(adminDataDir, 'data'), { recursive: true });
}

test.beforeEach(async () => resetFixture());

test('overview, navigation, search, selection, and preview links work', async ({ page }) => {
  await page.goto('/admin/');
  await expect(page.getByRole('heading', { name: /Shape the site/ })).toBeVisible();
  await expect(page.locator('.admin-stat')).toHaveCount(3);
  await expect(page.locator('.admin-entry-row')).toHaveCount(6);
  await expect(page.locator('.admin-view-link')).toHaveAttribute('href', '/');

  await page.locator('[data-tab="Posts"]').click();
  await expect(page.locator('#content-form')).toBeVisible();
  await page.locator('[data-filter-entries]').fill('welcome');
  await expect(page.locator('[data-select-id="welcome"]')).toBeVisible();
  await expect(page.locator('[data-select-id="goal-first-approach"]')).toBeHidden();
  await page.locator('[data-select-id="welcome"]').click();
  await expect(page.getByRole('heading', { name: 'Edit post' })).toBeVisible();

  for (const tab of ['Projects', 'Links', 'Featured', 'Site & design', 'Overview']) {
    await page.locator(`[data-tab="${tab}"]`).click();
    await expect(page.locator('.admin-breadcrumb')).toContainText(tab);
  }
});

test('posts can be previewed, validated, created, edited, and deleted', async ({ page }) => {
  await page.goto('/admin/');
  await page.locator('[data-tab="Posts"]').click();
  await page.locator('[data-new-entry]').click();
  await page.locator('#title').fill('E2E Admin Post');
  await page.locator('#description').fill('Post created by browser test');
  await page.locator('#tags').fill('browser, admin');
  await page.locator('#updated').fill('2026-10-02');
  await page.locator('#references').fill('Docs | https://example.com/docs');
  await page.locator('#body').fill('# Preview heading\n\n<img src=x onerror="alert(1)">');
  await page.locator('[name="draft"]').uncheck();
  await page.locator('[name="featured"]').check();
  await expect(page.locator('[data-preview] h1')).toHaveText('Preview heading');
  await expect(page.locator('[data-preview] [onerror]')).toHaveCount(0);

  await page.locator('#title').fill('');
  await page.locator('#content-form button[type="submit"]').click();
  await expect(page.locator('.admin-alert.is-error')).toContainText('Title is required');
  await expect(page.locator('#title')).toHaveValue('');

  await page.locator('#title').fill('E2E Admin Post');
  await page.locator('#description').fill('Post created by browser test');
  await page.locator('#tags').fill('browser, admin');
  await page.locator('#updated').fill('2026-10-02');
  await page.locator('#references').fill('Docs | https://example.com/docs');
  await page.locator('#body').fill('# Preview heading\n\n<img src=x onerror="alert(1)">');
  await page.locator('[name="draft"]').uncheck();
  await page.locator('[name="featured"]').check();
  await page.locator('#content-form button[type="submit"]').click();
  await expect(page.locator('.admin-alert.is-success')).toContainText('Saved');
  const created = await page.request.get('/__local_admin/api/');
  const payload = await created.json();
  const id = 'e2e-admin-post';
  expect(payload.entries.posts.find((entry: { id: string }) => entry.id === id)).toBeTruthy();
  const saved = payload.entries.posts.find((entry: { id: string }) => entry.id === id);
  expect(saved.data.tags).toEqual(['browser', 'admin']);
  expect(saved.data.draft).toBe(false);
  expect(saved.data.featured).toBe(true);
  expect(saved.data.references).toEqual([{ title: 'Docs', url: 'https://example.com/docs' }]);
  expect(saved.body).toContain('<img src=x');

  await page.locator('#description').fill('Edited by browser test');
  await page.locator('#content-form button[type="submit"]').click();
  await expect(page.locator('.admin-alert.is-success')).toContainText('Saved');
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('[data-delete-entry]').click();
  await expect(page.locator('.admin-alert.is-success')).toContainText('Entry deleted');
  const afterDelete = await (await page.request.get('/__local_admin/api/')).json();
  expect(afterDelete.entries.posts.some((entry: { id: string }) => entry.id === id)).toBe(false);
});

test('projects and links expose their own fields and support create, edit, and delete', async ({ page }) => {
  await page.goto('/admin/');
  for (const item of [
    { collection: 'Projects', id: 'e2e-admin-project', title: 'E2E Admin Project' },
    { collection: 'Links', id: 'e2e-admin-link', title: 'E2E Admin Link' },
  ]) {
    await page.locator(`[data-tab="${item.collection}"]`).click();
    await page.locator('[data-new-entry]').click();
    await page.locator('#title').fill(item.title);
    await page.locator('#description').fill(`${item.collection} fixture`);
    if (item.collection === 'Projects') {
      await page.locator('#status').selectOption('complete');
      await page.locator('#url').fill('https://example.com/project');
      await page.locator('#repository').fill('https://github.com/example/project');
      await page.locator('#body').fill('Project story');
    } else {
      await page.locator('#url').fill('https://example.com/article');
      await page.locator('#source').fill('Example');
      await expect(page.locator('#body')).toHaveCount(0);
    }
    await page.locator('#content-form button[type="submit"]').click();
    await expect(page.locator('.admin-alert.is-success')).toContainText('Saved');

    const payload = await (await page.request.get('/__local_admin/api/')).json();
    const key = item.collection.toLowerCase();
    const saved = payload.entries[key].find((entry: { id: string }) => entry.id === item.id);
    expect(saved).toBeTruthy();
    if (key === 'projects') expect(saved.data.status).toBe('complete');
    else expect(saved.data.source).toBe('Example');

    await page.locator('#title').fill(`${item.title} edited`);
    await page.locator('#content-form button[type="submit"]').click();
    await expect(page.locator('.admin-alert.is-success')).toContainText('Saved');
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('[data-delete-entry]').click();
    await expect(page.locator('.admin-alert.is-success')).toContainText('Entry deleted');
  }
});

test('featured content toggles published entries and disables draft entries', async ({ page }) => {
  await page.goto('/admin/');
  await page.locator('[data-tab="Featured"]').click();
  const linkToggle = page.locator('[data-featured="links:pagefind"]');
  await expect(linkToggle).toHaveAttribute('aria-checked', 'true');
  await linkToggle.click();
  await expect(page.locator('[data-featured="links:pagefind"]')).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('.admin-alert.is-success')).toContainText('Featured selection saved');

  await page.locator('[data-tab="Posts"]').click();
  await page.locator('[data-new-entry]').click();
  await page.locator('#title').fill('Draft for featured test');
  await page.locator('#description').fill('Draft entry');
  await page.locator('#content-form button[type="submit"]').click();
  const draft = page.locator('[data-featured="posts:draft-for-featured-test"]');
  await page.locator('[data-tab="Featured"]').click();
  await expect(draft).toBeDisabled();
});

test('settings fields, repeatable links, colors, and section order save', async ({ page }) => {
  await page.goto('/admin/');
  await page.locator('[data-tab="Site & design"]').click();

  // These controls rerender the form, so do them before filling text fields.
  await page.locator('[data-add-row="navigation"]').click();
  await page.locator('[data-remove-row="navigation.0"]').click();
  await page.locator('[data-add-row="footerLinks"]').click();
  await page.locator('[data-remove-row="footerLinks.1"]').click();
  await page.locator('[data-move-section="0:down"]').click();

  await page.locator('[name="site.name"]').fill('E2E Field Notes');
  await page.locator('[name="site.description"]').fill('E2E default description');
  await page.locator('[name="site.homeDescription"]').fill('E2E homepage note');
  await page.locator('[name="site.footerText"]').fill('E2E footer {year} {name}');
  await page.locator('[name="pages.blog.title"]').fill('E2E Writing');
  await page.locator('[name="home.recentPostLimit"]').fill('5');
  await page.locator('[name="theme.fonts.sans"]').selectOption('Arial');
  await page.locator('[name="theme.layout.shellWidthRem"]').fill('80');
  await page.locator('input[type="color"][name="theme.dark.accent"]').fill('#123456');

  await page.locator('[name="navigation.2.label"]').fill('E2E Nav');
  await page.locator('[name="navigation.2.href"]').fill('/e2e/');
  await page.locator('[name="footerLinks.1.label"]').fill('E2E Footer');
  await page.locator('[name="footerLinks.1.href"]').fill('https://example.com');
  await page.locator('[name="section.1.title"]').fill('E2E themes');
  await page.locator('[name="section.1.visible"]').uncheck();
  await page.locator('button[form="settings-form"]').click();
  await expect(page.locator('.admin-alert.is-success')).toContainText('Settings saved');

  const saved = await (await page.request.get('/__local_admin/api/')).json();
  expect(saved.settings.site.name).toBe('E2E Field Notes');
  expect(saved.settings.site.description).toBe('E2E default description');
  expect(saved.settings.site.homeDescription).toBe('E2E homepage note');
  expect(saved.settings.site.footerText).toBe('E2E footer {year} {name}');
  expect(saved.settings.pages.blog.title).toBe('E2E Writing');
  expect(saved.settings.home.recentPostLimit).toBe(5);
  expect(saved.settings.theme.fonts.sans).toBe('Arial');
  expect(saved.settings.theme.layout.shellWidthRem).toBe(80);
  expect(saved.settings.theme.dark.accent).toBe('#123456');
  expect(saved.settings.site.navigation).toEqual([
    { label: 'Projects', href: '/projects/', visible: true },
    { label: 'Links', href: '/links/', visible: true },
    { label: 'E2E Nav', href: '/e2e/', visible: true },
  ]);
  expect(saved.settings.site.footerLinks).toEqual([
    { label: 'RSS', href: '/rss.xml' },
    { label: 'E2E Footer', href: 'https://example.com' },
  ]);
  expect(saved.settings.home.sidebarSections[1].id).toBe('themes');
  expect(saved.settings.home.sidebarSections[1].title).toBe('E2E themes');
  expect(saved.settings.home.sidebarSections[1].visible).toBe(false);
});

test('invalid settings and failed save requests show errors without persisting', async ({ page }) => {
  await page.goto('/admin/');
  await page.locator('[data-tab="Site & design"]').click();
  await page.locator('[name="theme.layout.shellWidthRem"]').fill('500');
  await page.locator('button[form="settings-form"]').click();
  await expect(page.locator('.admin-alert.is-error')).toContainText('shellWidthRem must be between');
  const unchanged = await (await page.request.get('/__local_admin/api/')).json();
  expect(unchanged.settings.theme.layout.shellWidthRem).toBe(76);

  await page.locator('[data-tab="Projects"]').click();
  await page.locator('[data-new-entry]').click();
  await page.locator('#title').fill('Rejected by API');
  await page.locator('#description').fill('This save is intercepted');
  await page.route('**/__local_admin/api/content', (route) => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Simulated save failure.' }) }));
  await page.locator('#content-form button[type="submit"]').click();
  await expect(page.locator('.admin-alert.is-error')).toContainText('Simulated save failure');

  const rejectedHost = await page.request.get('/__local_admin/api/', { headers: { Host: 'not-local.example' } });
  expect(rejectedHost.status()).toBe(403);
});

test('public pages fit mobile, tablet, and desktop widths', async ({ page }) => {
  const paths = [
    '/',
    '/blog/',
    '/blog/welcome/',
    '/tags/life/',
    '/projects/',
    '/projects/field-notes/',
    '/links/',
    '/search/',
  ];

  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of paths) {
      await page.goto(path);
      await expect(page.locator('main')).toBeVisible();
      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
        overflowing: [...document.querySelectorAll<HTMLElement>('*')]
          .map((element) => ({ element, rect: element.getBoundingClientRect() }))
          .filter(({ rect }) => rect.right > document.documentElement.clientWidth + 1 || rect.left < -1)
          .map(({ element, rect }) => `${element.tagName.toLowerCase()}.${element.className} (${Math.round(rect.left)}..${Math.round(rect.right)})`)
          .slice(0, 8),
      }));
      expect(dimensions.document, `${path} overflows at ${width}px: ${dimensions.overflowing.join(', ')}`).toBeLessThanOrEqual(dimensions.viewport);
    }
  }

  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/');
  await page.locator('#search-toggle').click();
  const searchLayout = await page.evaluate(() => {
    const container = document.querySelector('#header-search')!;
    const popover = document.querySelector('.header-search-popover')!.getBoundingClientRect();
    const toggle = document.querySelector('#search-toggle')!.getBoundingClientRect();
    return {
      isOpen: container.classList.contains('is-open'),
      overlapsToggle: popover.left < toggle.right && popover.right > toggle.left && popover.top < toggle.bottom && popover.bottom > toggle.top,
    };
  });
  expect(searchLayout.isOpen).toBe(true);
  expect(searchLayout.overlapsToggle, 'mobile search results should not cover the search toggle').toBe(false);
});
