import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import type { FullConfig } from '@playwright/test';

const root = resolve(import.meta.dirname, '../..');
const merchantUrl = 'http://localhost:5173';
const storefrontUrl = 'http://localhost:5174';
const children: ChildProcess[] = [];

async function stop(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGINT');
  const result = await Promise.race([exited.then(() => true), delay(20000).then(() => false)]);
  if (!result) {
    child.kill('SIGKILL');
    await exited;
    throw new Error('A browser E2E child process exceeded its graceful shutdown deadline.');
  }
}

async function cleanup() {
  // Stop Vite before the demo, so the API can finish in-flight requests and
  // drop only the random database it created itself.
  const results = await Promise.allSettled(children.reverse().map(stop));
  const rejected = results.find(result => result.status === 'rejected');
  if (rejected?.status === 'rejected') throw rejected.reason;
}

async function waitForHttp(url: string, child: ChildProcess, label: string) {
  for (let i = 0; i < 300; i++) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error(`${label} exited before readiness.`);
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1500) })).ok) return; } catch { /* retry while starting */ }
    await delay(200);
  }
  throw new Error(`${label} did not become ready within 60 seconds.`);
}

async function waitForDemo(child: ChildProcess): Promise<{ port: number; credentialsPath: string }> {
  let output = '';
  const ready = new Promise<{ port: number; credentialsPath: string }>((resolveReady, rejectReady) => {
    const consume = (chunk: Buffer) => {
      output += chunk.toString('utf8');
      const port = output.match(/"storefront":"http:\/\/127\.0\.0\.1:(\d+)\/v1\/storefront\//)?.[1];
      const credentialsPath = output.match(/Demo running\. Private local credentials: (.+?credentials\.json)\./)?.[1];
      if (port && credentialsPath) resolveReady({ port: Number(port), credentialsPath });
      if (output.length > 20000) output = output.slice(-15000);
    };
    child.stdout?.on('data', consume);
    child.stderr?.on('data', consume);
    child.once('exit', () => rejectReady(new Error('Disposable API demo exited before completing its seed journey.')));
  });
  return Promise.race([ready, delay(180000).then(() => { throw new Error('Disposable API demo startup exceeded 180 seconds.'); })]);
}

export default async function globalSetup(_config: FullConfig) {
  if (process.env.NODE_ENV === 'production') throw new Error('Browser E2E never runs in production mode.');
  if (process.env.COMMERCE_E2E_EXTERNAL_URL) throw new Error('Browser E2E requires its own disposable loopback API.');
  const originalUrl = process.env.DATABASE_URL ?? 'postgresql://commerce:commerce@127.0.0.1:5432/commerce';
  const database = new URL(originalUrl);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(database.hostname)) throw new Error('Browser E2E refuses non-loopback PostgreSQL.');
  try {
    const demo = spawn(process.execPath, ['apps/api/scripts/demo-backend.mjs'], {
      cwd: root,
      env: { ...process.env, COMMERCE_BROWSER_E2E: 'true', NODE_ENV: 'test' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    children.push(demo);
    const { port, credentialsPath } = await waitForDemo(demo);
    // The demo creates these files with mode 0600 under a private temp directory.
    const credentials = JSON.parse(await readFile(credentialsPath, 'utf8'));
    if (!credentials.storeHandle || !credentials.password) throw new Error('Disposable demo credentials were incomplete.');
    process.env.COMMERCE_E2E_CREDENTIALS_PATH = credentialsPath;
    process.env.COMMERCE_E2E_MAIL_DIR = resolve(dirname(credentialsPath), 'mail');
    process.env.COMMERCE_E2E_STORE_HANDLE = credentials.storeHandle;

    for (const [label, app, url, target] of [
      ['Merchant UI', 'admin', merchantUrl, 'ADMIN_API_TARGET'],
      ['Customer UI', 'storefront', storefrontUrl, 'STOREFRONT_API_TARGET']
    ] as const) {
      const appRoot = resolve(root, 'apps', app);
      // Spawn Vite directly, so SIGINT stops the actual server rather than
      // leaving a package-manager grandchild holding the fixed port.
      const web = spawn(process.execPath, [resolve(appRoot, 'node_modules/vite/bin/vite.js')], {
        cwd: appRoot,
        env: { ...process.env, [target]: `http://127.0.0.1:${port}` },
        stdio: ['ignore', 'pipe', 'pipe']
      });
      children.push(web);
      await waitForHttp(url, web, label);
    }
    console.log('Browser E2E: disposable API and both React apps ready on loopback.');
    return cleanup;
  } catch (error) {
    await cleanup();
    throw error;
  }
}
