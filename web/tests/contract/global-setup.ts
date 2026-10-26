import { type ChildProcess, spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    apiBaseUrl: string;
  }
}

const API_DIR = fileURLToPath(new URL('../../../api', import.meta.url));
const STARTUP_TIMEOUT_MS = 30_000;

// Binding to port 0 makes the OS hand out a free port.
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

async function waitForHealth(baseUrl: string, child: ChildProcess, output: () => string): Promise<void> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`API exited early (code ${child.exitCode}):\n${output()}`);
    try {
      if ((await fetch(`${baseUrl}/`)).ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`API did not answer GET / within ${STARTUP_TIMEOUT_MS}ms:\n${output()}`);
}

export default async function setup(project: TestProject) {
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['-r', 'ts-node/register', 'src/main.ts'], {
    cwd: API_DIR,
    // The spawned API logs searches, so it gets its own log file and never touches the developer's.
    env: { ...process.env, ENABLE_INSIGHTS: 'true', PORT: String(port), SEARCH_LOG_FILE: join(mkdtempSync(join(tmpdir(), 'search-log-contract-')), 'search-log.json') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout?.on('data', (d) => (log += d));
  child.stderr?.on('data', (d) => (log += d));

  try {
    await waitForHealth(baseUrl, child, () => log);
  } catch (error) {
    child.kill();
    throw error;
  }
  project.provide('apiBaseUrl', baseUrl);

  return () =>
    new Promise<void>((resolve) => {
      if (child.exitCode !== null) return resolve();
      child.once('exit', () => resolve());
      child.kill('SIGTERM');
    });
}
