import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = 'dist';
const requiredFiles = [
  'pagefind/pagefind.js',
  'rss.xml',
  'sitemap-index.xml',
  'blog/index.html',
  'projects/index.html',
  'projects/field-notes/index.html',
  'links/index.html',
  'tags/life/index.html',
];

for (const file of requiredFiles) {
  try {
    await access(join(root, file));
  } catch {
    throw new Error(`Expected build artifact is missing: ${file}`);
  }
}

for (const forbiddenPath of ['admin', '__local_admin']) {
  try {
    await access(join(root, forbiddenPath));
    throw new Error(`Local admin content must not be included in production output: ${forbiddenPath}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Local admin content')) throw error;
  }
}

const pagefindScript = await readFile(join(root, 'pagefind/pagefind.js'), 'utf8');
if (!pagefindScript.trim()) throw new Error('Pagefind script is empty.');

console.log(`Verified ${requiredFiles.length} build artifacts.`);
