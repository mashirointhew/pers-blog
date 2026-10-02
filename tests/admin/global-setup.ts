import { cp, mkdir, rm } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { adminDataDir } from './paths';

export default async function globalSetup() {
  const projectRoot = resolve(import.meta.dirname, '../..');
  await rm(adminDataDir, { recursive: true, force: true });
  await mkdir(adminDataDir, { recursive: true });
  await cp(join(projectRoot, 'src', 'content'), join(adminDataDir, 'content'), { recursive: true });
  await cp(join(projectRoot, 'src', 'data'), join(adminDataDir, 'data'), { recursive: true });

  let logs = '';
  const server = spawn(process.execPath, [
    join(projectRoot, 'node_modules', 'astro', 'astro.js'),
    'dev', '--host', '127.0.0.1', '--port', '4322', '--strictPort',
  ], {
    cwd: projectRoot,
    env: { ...process.env, LOCAL_ADMIN_DATA_DIR: adminDataDir },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const recordLog = (chunk: Buffer) => { logs = `${logs}${chunk}`.slice(-8_000); };
  server.stdout.on('data', recordLog);
  server.stderr.on('data', recordLog);

  try {
    for (let attempt = 0; attempt < 240; attempt += 1) {
      if (server.exitCode !== null) throw new Error(`Admin test server exited with code ${server.exitCode}.`);
      try {
        const response = await fetch('http://127.0.0.1:4322/admin/');
        if (response.ok) return async () => {
          await stopServer();
          await rm(adminDataDir, { recursive: true, force: true });
        };
      } catch {
        // The dev server is still starting.
      }
      await delay(250);
    }
    throw new Error('Timed out waiting for the admin test server.');
  } catch (error) {
    await stopServer();
    await rm(adminDataDir, { recursive: true, force: true });
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${logs}`);
  }

  async function stopServer() {
    if (server.exitCode === null && server.signalCode === null) {
      server.kill();
      await Promise.race([new Promise<void>((resolveExit) => server.once('exit', () => resolveExit())), delay(2_000)]);
    }
    if (server.exitCode === null && server.signalCode === null && server.pid) {
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      } else {
        server.kill('SIGKILL');
      }
      await Promise.race([new Promise<void>((resolveExit) => server.once('exit', () => resolveExit())), delay(2_000)]);
    }
  }
}
