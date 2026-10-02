import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Playwright loads global setup and test workers in separate processes, so use
// one known path shared by all of them. The suite runs serially on a fixed port.
export const adminDataDir = join(tmpdir(), 'pers-blog-admin-e2e');
